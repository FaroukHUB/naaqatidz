import Link from "next/link";
import { notFound } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import type { PackingPlan } from "@/lib/domain/packing";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, type OrderStatus } from "@/lib/order-labels";
import { Notice } from "@/components/ui/Notice";

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ nouvelle?: string }> };

export default async function ResellerOrderPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const { nouvelle } = await searchParams;
  const supabase = await createSessionClient();
  // RLS : une commande d'un autre compte n'est jamais renvoyée (→ 404).
  const { data: order } = await supabase
    .from("orders")
    .select("id, reference, created_at, status, payment_method, currency, subtotal_minor, shipping_minor, shipping_quote_status, total_minor, shipping_method_label, ship_address, ship_wilaya_name, ship_commune_name, ship_city, ship_postal_code, ship_country, packing_plan")
    .eq("reference", reference)
    .maybeSingle();
  if (!order) notFound();
  const [{ data: items }, { data: shipments }] = await Promise.all([
    supabase.from("order_items").select("sku, product_name, variant_label, quantity, unit_price_minor, line_total_minor").eq("order_id", order.id).order("position"),
    supabase.from("order_shipments").select("carton_index, carrier, tracking_number, status").eq("order_id", order.id),
  ]);
  const plan = order.packing_plan as PackingPlan | null;
  const cur = order.currency as string;

  return (
    <div className="max-w-3xl space-y-6">
      {nouvelle && <Notice tone="success" title="Commande enregistrée">Référence {order.reference}.</Notice>}
      <div>
        <Link href="/revendeur/commandes" className="text-sm underline">← Mes commandes</Link>
        <h1 className="mt-2 font-mono text-2xl">{order.reference}</h1>
        <p className="text-sm text-encre/70">{new Date(order.created_at).toLocaleString("fr-FR")} · {STATUS_LABELS[order.status as OrderStatus]} · {PAYMENT_METHOD_LABELS[order.payment_method as "cod" | "a_definir"]}</p>
      </div>
      <section className="card p-4">
        <ul className="divide-y divide-sable text-sm">
          {(items ?? []).map((i) => (
            <li key={i.sku} className="flex justify-between gap-3 py-2">
              <span>{i.product_name}{i.variant_label ? ` — ${i.variant_label}` : ""} × {i.quantity} <span className="text-encre/60">({formatMoney(Number(i.unit_price_minor), cur)})</span></span>
              <span className="font-semibold">{formatMoney(Number(i.line_total_minor), cur)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-sable pt-3 text-sm">
          <div className="flex justify-between"><dt>Sous-total</dt><dd>{formatMoney(Number(order.subtotal_minor), cur)}</dd></div>
          <div className="flex justify-between"><dt>Livraison{order.shipping_method_label ? ` (${order.shipping_method_label})` : ""}</dt><dd>{order.shipping_minor !== null ? formatMoney(Number(order.shipping_minor), cur) : "À confirmer"}</dd></div>
          <div className="flex justify-between font-semibold"><dt>{order.shipping_quote_status === "to_confirm" ? "Total hors livraison" : "Total"}</dt><dd>{formatMoney(Number(order.total_minor), cur)}</dd></div>
        </dl>
      </section>
      <section className="card p-4 text-sm">
        <h2 className="text-xl">Livraison</h2>
        <p className="mt-2 whitespace-pre-line">{order.ship_address}</p>
        <p>{[order.ship_commune_name, order.ship_wilaya_name, order.ship_postal_code, order.ship_city, order.ship_country].filter(Boolean).join(", ")}</p>
        {shipments && shipments.length > 0 && (
          <ul className="mt-3 space-y-1">
            {shipments.map((s, i) => (
              <li key={i}>Colis {s.carton_index ?? i + 1} : {s.carrier ?? "Transporteur"} — suivi <strong>{s.tracking_number ?? "à venir"}</strong>{s.status ? ` (${s.status})` : ""}</li>
            ))}
          </ul>
        )}
      </section>
      {plan && (
        <section className="card p-4 text-sm">
          <h2 className="text-xl">Colisage : {plan.cartons.length} carton{plan.cartons.length > 1 ? "s" : ""}</h2>
          <ol className="mt-2 space-y-1">
            {plan.cartons.map((c) => (
              <li key={c.index}>Carton {c.index} ({(c.grossWeightG / 1000).toLocaleString("fr-FR")} kg) : {c.contents.map((x) => `${x.quantity} × ${x.sku}`).join(", ")}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
