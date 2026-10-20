import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-labels";

export default async function ResellerOrdersPage() {
  const supabase = await createSessionClient();
  // La RLS ne renvoie que les commandes du compte connecté.
  const { data: orders } = await supabase
    .from("orders")
    .select("reference, created_at, status, currency, total_minor, shipping_quote_status")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <div>
      <h1 className="text-3xl">Mes commandes</h1>
      {!orders?.length ? (
        <p className="mt-6">Aucune commande pour le moment.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-sable bg-white">
          <table className="table-admin">
            <thead><tr><th>Référence</th><th>Date</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.reference}>
                  <td><Link className="font-mono text-titre underline" href={`/revendeur/commandes/${o.reference}`}>{o.reference}</Link></td>
                  <td>{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                  <td>{STATUS_LABELS[o.status as OrderStatus]}</td>
                  <td className="text-right">{formatMoney(Number(o.total_minor), o.currency)}{o.shipping_quote_status === "to_confirm" ? " (hors livraison)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
