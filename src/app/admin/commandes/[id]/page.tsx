import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, toMajor } from "@/lib/domain/money";
import type { PackingPlan } from "@/lib/domain/packing";
import { CHANNEL_LABELS, ORDER_STATUSES, PAYMENT_METHOD_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, STATUS_LABELS, type PaymentStatus } from "@/lib/order-labels";
import { addShipment, adjustPacking, confirmShippingAmount, deleteShipment, updateOrderNotes, updateOrderStatus } from "@/lib/actions/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../../Flash";

export const metadata: Metadata = { title: "Commande" };

const ORDER_COLUMNS =
  "id, reference, channel, user_id, status, payment_method, payment_status, customer_name, customer_phone, customer_email, company_name, ship_country, ship_wilaya_code, ship_wilaya_name, ship_commune_code, ship_commune_name, ship_city, ship_postal_code, ship_address, ship_notes, currency, subtotal_minor, shipping_minor, shipping_quote_status, total_minor, shipping_method_label, carrier, conditions, packing_status, packing_plan, admin_notes, created_at";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> };

export default async function AdminOrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const flash = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createSessionClient();
  // Liste explicite : les colonnes techniques (idempotence, jeton de confirmation) ne sont lisibles par aucun compte.
  const { data: o } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: items }, { data: shipments }, { data: events }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("order_shipments").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_events").select("*").eq("order_id", id).order("id", { ascending: false }).limit(50),
  ]);
  const cur = o.currency as string;
  const plan = o.packing_plan as PackingPlan | null;
  const planText = plan?.cartons.map((c) => c.contents.map((x) => `${x.sku}:${x.quantity}`).join(", ")).join("\n") ?? "";
  const conditions = o.conditions as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <Link href="/admin/commandes" className="text-sm underline">← Commandes</Link>
      <Flash params={flash} />
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl">{o.reference}</h1>
        <span className="rounded-full bg-creme px-3 py-1 text-sm">{CHANNEL_LABELS[o.channel as keyof typeof CHANNEL_LABELS]}</span>
        <span className="text-sm text-encre/70">{new Date(o.created_at).toLocaleString("fr-FR")}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="text-xl">Statut</h2>
          <form action={updateOrderStatus} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={o.id} />
            <div>
              <label htmlFor="status" className="field-label">Statut de la commande</label>
              <select id="status" name="status" defaultValue={o.status} className="field">
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="payment_status" className="field-label">Statut du paiement</label>
              <select id="payment_status" name="payment_status" defaultValue={o.payment_status} className="field">
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><button className="btn-primary btn-small">Enregistrer</button></div>
          </form>
          <p className="text-sm text-encre/70">Mode de paiement : {PAYMENT_METHOD_LABELS[o.payment_method as "cod" | "a_definir"]} · Paiement actuel : {PAYMENT_STATUS_LABELS[o.payment_status as PaymentStatus]}</p>
        </section>

        <section className="card space-y-1 p-4 text-sm">
          <h2 className="text-xl">Client et livraison</h2>
          <p><strong>{o.customer_name}</strong>{o.company_name ? ` — ${o.company_name}` : ""}</p>
          <p><a href={`tel:${o.customer_phone}`} className="underline">{o.customer_phone}</a>{o.customer_email ? ` · ${o.customer_email}` : ""}</p>
          <p className="whitespace-pre-line">{o.ship_address}</p>
          <p>{[o.ship_commune_name && `${o.ship_commune_name} (${o.ship_commune_code})`, o.ship_wilaya_name && `${o.ship_wilaya_name} (${o.ship_wilaya_code})`, o.ship_postal_code, o.ship_city, o.ship_country].filter(Boolean).join(", ")}</p>
          {o.ship_notes && <p className="italic">« {o.ship_notes} »</p>}
          <p>Mode : {o.shipping_method_label ?? "—"}{o.carrier ? ` · Transporteur : ${o.carrier}` : ""}</p>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="text-xl">Articles (prix et libellés enregistrés à la commande)</h2>
        <div className="overflow-x-auto">
          <table className="table-admin mt-2">
            <thead><tr><th>SKU</th><th>Produit</th><th className="text-right">Qté</th><th className="text-right">Prix unitaire</th><th className="text-right">Poids unit.</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {(items ?? []).map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.sku}</td>
                  <td>{i.product_name}{i.variant_label ? ` — ${i.variant_label}` : ""}</td>
                  <td className="text-right">{i.quantity}</td>
                  <td className="text-right">{formatMoney(Number(i.unit_price_minor), cur)}</td>
                  <td className="text-right">{i.unit_weight_g ? `${i.unit_weight_g} g` : "—"}</td>
                  <td className="text-right">{formatMoney(Number(i.line_total_minor), cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 ml-auto max-w-sm space-y-1 text-sm">
          <div className="flex justify-between"><dt>Sous-total</dt><dd>{formatMoney(Number(o.subtotal_minor), cur)}</dd></div>
          <div className="flex justify-between"><dt>Livraison</dt><dd>{o.shipping_minor !== null ? formatMoney(Number(o.shipping_minor), cur) : <span className="text-erreur">à confirmer</span>}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatMoney(Number(o.total_minor), cur)}</dd></div>
        </dl>
        <form action={confirmShippingAmount} className="mt-3 flex flex-wrap items-end gap-2 border-t border-sable pt-3">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="currency" value={cur} />
          <div>
            <label htmlFor="amount" className="field-label">{o.shipping_minor === null ? "Confirmer les frais de livraison" : "Corriger les frais de livraison"} ({cur})</label>
            <input id="amount" name="amount" inputMode="decimal" className="field w-40" defaultValue={o.shipping_minor !== null ? String(toMajor(Number(o.shipping_minor), cur)) : ""} />
          </div>
          <button className="btn-secondary btn-small">Enregistrer</button>
        </form>
      </section>

      {(plan || o.channel === "reseller_dz") && (
        <section className="card space-y-3 p-4">
          <h2 className="text-xl">Colisage {o.packing_status === "adjusted" ? "(ajusté manuellement)" : "(calculé)"}</h2>
          {plan ? (
            <>
              <p className="text-sm text-encre/70">
                {plan.cartons.length} carton(s) · capacité utile {plan.capacityG} g par carton (max {plan.config.maxCartonWeightG} g − tare {plan.config.cartonTareG} g − marge {plan.config.safetyMarginG} g) ·
                {plan.provedMinimal ? " nombre minimal prouvé" : ` borne inférieure : ${plan.lowerBound}`}. Volume et fragilité non vérifiés.
              </p>
              <ol className="grid gap-2 sm:grid-cols-2">
                {plan.cartons.map((c) => (
                  <li key={c.index} className="rounded-md bg-creme p-3 text-sm">
                    <p className="font-semibold">Carton {c.index} — {c.grossWeightG} g (produits {c.itemsWeightG} g + tare {c.tareG} g)</p>
                    <ul>{c.contents.map((x) => <li key={x.sku}>{x.quantity} × <span className="font-mono">{x.sku}</span> ({x.weightG} g)</li>)}</ul>
                  </li>
                ))}
              </ol>
              <form action={adjustPacking} className="space-y-2">
                <input type="hidden" name="id" value={o.id} />
                <label htmlFor="plan" className="field-label">Ajuster la répartition (une ligne par carton, format « SKU:quantité, SKU:quantité »)</label>
                <textarea id="plan" name="plan" defaultValue={planText} rows={Math.max(3, plan.cartons.length + 1)} className="field font-mono text-sm" />
                <button className="btn-secondary btn-small">Vérifier et enregistrer</button>
              </form>
            </>
          ) : (
            <p className="text-sm">Aucun plan enregistré.</p>
          )}
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl">Expédition et suivi</h2>
        <p className="text-xs text-encre/70">Saisie manuelle. Aucune connexion transporteur n&apos;est active.</p>
        {shipments && shipments.length > 0 && (
          <ul className="space-y-1 text-sm">
            {shipments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span>Colis {s.carton_index ?? "—"} · {s.carrier ?? "Transporteur ?"} · <strong>{s.tracking_number}</strong>{s.status ? ` · ${s.status}` : ""}</span>
                <form action={deleteShipment}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="shipment_id" value={s.id} />
                  <button className="text-xs text-erreur underline">Supprimer</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addShipment} className="grid gap-2 sm:grid-cols-5">
          <input type="hidden" name="id" value={o.id} />
          <div><label className="field-label" htmlFor="carton_index">Carton n°</label><input id="carton_index" name="carton_index" inputMode="numeric" className="field" /></div>
          <div><label className="field-label" htmlFor="carrier">Transporteur</label><input id="carrier" name="carrier" className="field" defaultValue={o.carrier ?? ""} /></div>
          <div><label className="field-label" htmlFor="tracking_number">Référence de suivi *</label><input id="tracking_number" name="tracking_number" className="field" required /></div>
          <div><label className="field-label" htmlFor="sstatus">État</label><input id="sstatus" name="status" className="field" placeholder="ex. remis au transporteur" /></div>
          <div className="flex items-end"><button className="btn-secondary btn-small w-full">Ajouter</button></div>
        </form>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl">Notes internes</h2>
        <form action={updateOrderNotes} className="space-y-2">
          <input type="hidden" name="id" value={o.id} />
          <textarea name="admin_notes" defaultValue={o.admin_notes ?? ""} rows={3} className="field" aria-label="Notes internes" />
          <button className="btn-secondary btn-small">Enregistrer la note</button>
        </form>
      </section>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Conditions enregistrées et historique</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-creme p-2 text-xs">{JSON.stringify(conditions, null, 2)}</pre>
        <ul className="mt-3 space-y-1">
          {(events ?? []).map((e) => (
            <li key={e.id}>{new Date(e.created_at).toLocaleString("fr-FR")} — {e.kind}{e.from_value ? ` : ${e.from_value} → ` : e.to_value ? " : " : ""}{e.to_value ?? ""}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
