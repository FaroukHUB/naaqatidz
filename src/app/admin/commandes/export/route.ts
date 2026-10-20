import { NextResponse, type NextRequest } from "next/server";
import { toMajor } from "@/lib/domain/money";
import type { PackingPlan } from "@/lib/domain/packing";
import { CHANNEL_LABELS, STATUS_LABELS, type OrderStatus } from "@/lib/order-labels";
import { queryOrders } from "@/lib/server/admin-orders";
import { getViewer } from "@/lib/server/viewer";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Export CSV GÉNÉRIQUE pour la préparation des commandes (une ligne par article et par carton).
 * Ce format n'est PAS le format d'import Maystro : celui-ci n'a pas été obtenu ni vérifié.
 */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Protection contre l'injection de formules dans les tableurs.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.status !== "active") return new NextResponse("Accès refusé", { status: 403 });
  const filters = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { data } = await queryOrders(
    filters,
    "id, reference, created_at, channel, status, customer_name, company_name, customer_phone, ship_country, ship_wilaya_code, ship_wilaya_name, ship_commune_code, ship_commune_name, ship_postal_code, ship_city, ship_address, ship_notes, currency, subtotal_minor, shipping_minor, total_minor, payment_method, shipping_method_label, packing_plan",
    { paginate: false },
  );
  const orders = (data ?? []) as unknown as Record<string, unknown>[];
  const supabase = await createSessionClient();
  const ids = orders.map((o) => o.id as string);
  const { data: items } = ids.length
    ? await supabase.from("order_items").select("order_id, sku, product_name, variant_label, quantity, unit_price_minor").in("order_id", ids).order("position")
    : { data: [] as { order_id: string; sku: string; product_name: string; variant_label: string | null; quantity: number; unit_price_minor: number }[] };

  const header = [
    "reference", "date", "parcours", "statut", "client", "societe", "telephone", "pays", "code_wilaya", "wilaya", "code_commune", "commune",
    "code_postal", "ville", "adresse", "indications", "mode_livraison", "paiement", "devise", "total_commande", "livraison", "carton", "sku", "produit", "quantite", "prix_unitaire",
  ];
  const lines = [header.map(cell).join(";")];
  for (const o of orders) {
    const cur = o.currency as string;
    const base = [
      o.reference, new Date(o.created_at as string).toISOString(), CHANNEL_LABELS[o.channel as keyof typeof CHANNEL_LABELS], STATUS_LABELS[o.status as OrderStatus],
      o.customer_name, o.company_name, o.customer_phone, o.ship_country, o.ship_wilaya_code, o.ship_wilaya_name, o.ship_commune_code, o.ship_commune_name,
      o.ship_postal_code, o.ship_city, o.ship_address, o.ship_notes, o.shipping_method_label, o.payment_method === "cod" ? "à la livraison" : "selon conditions",
      cur, toMajor(Number(o.total_minor), cur), o.shipping_minor === null ? "à confirmer" : toMajor(Number(o.shipping_minor), cur),
    ];
    const orderItems = (items ?? []).filter((i) => i.order_id === o.id);
    const byName = new Map(orderItems.map((i) => [i.sku, i]));
    const plan = o.packing_plan as PackingPlan | null;
    if (plan?.cartons?.length) {
      for (const c of plan.cartons) {
        for (const x of c.contents) {
          const i = byName.get(x.sku);
          lines.push([...base, c.index, x.sku, i ? `${i.product_name}${i.variant_label ? ` — ${i.variant_label}` : ""}` : "", x.quantity, i ? toMajor(Number(i.unit_price_minor), cur) : ""].map(cell).join(";"));
        }
      }
    } else {
      for (const i of orderItems) {
        lines.push([...base, "", i.sku, `${i.product_name}${i.variant_label ? ` — ${i.variant_label}` : ""}`, i.quantity, toMajor(Number(i.unit_price_minor), cur)].map(cell).join(";"));
      }
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="naaqati-commandes-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
