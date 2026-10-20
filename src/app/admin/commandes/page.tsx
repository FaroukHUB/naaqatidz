import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/domain/money";
import { CHANNEL_LABELS, ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/order-labels";
import { PAGE_SIZE, queryOrders, type OrderFilters } from "@/lib/server/admin-orders";

export const metadata: Metadata = { title: "Commandes" };

interface Row {
  id: string;
  reference: string;
  created_at: string;
  channel: keyof typeof CHANNEL_LABELS;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  company_name: string | null;
  ship_wilaya_name: string | null;
  ship_commune_name: string | null;
  currency: string;
  total_minor: number;
  shipping_quote_status: string;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrderFilters> }) {
  const filters = await searchParams;
  const { data, count, error } = await queryOrders(
    filters,
    "id, reference, created_at, channel, status, customer_name, customer_phone, company_name, ship_wilaya_name, ship_commune_name, currency, total_minor, shipping_quote_status",
    { paginate: true },
  );
  const rows = (data ?? []) as unknown as Row[];
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const qs = (p: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page: String(p) }).toString();
  const exportQs = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && k !== "page"))).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Commandes</h1>
        <a href={`/admin/commandes/export?${exportQs}`} className="btn-secondary btn-small">Exporter (CSV)</a>
      </div>
      <form className="card grid gap-3 p-3 sm:grid-cols-6" role="search">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="field-label">Recherche</label>
          <input id="q" name="q" defaultValue={filters.q} placeholder="Référence, nom, téléphone" className="field" />
        </div>
        <div>
          <label htmlFor="statut" className="field-label">Statut</label>
          <select id="statut" name="statut" defaultValue={filters.statut ?? ""} className="field">
            <option value="">Tous</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="canal" className="field-label">Parcours</label>
          <select id="canal" name="canal" defaultValue={filters.canal ?? ""} className="field">
            <option value="">Tous</option>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="du" className="field-label">Du</label>
          <input id="du" name="du" type="date" defaultValue={filters.du} className="field" />
        </div>
        <div>
          <label htmlFor="au" className="field-label">Au</label>
          <input id="au" name="au" type="date" defaultValue={filters.au} className="field" />
        </div>
        <div className="sm:col-span-6"><button className="btn-primary btn-small">Filtrer</button> <Link href="/admin/commandes" className="ml-2 text-sm underline">Réinitialiser</Link></div>
      </form>
      {error && <p className="text-erreur">Impossible de charger les commandes.</p>}
      <p className="text-sm text-encre/70">{count ?? 0} commande(s)</p>
      <div className="overflow-x-auto rounded-lg border border-sable bg-white">
        <table className="table-admin">
          <thead>
            <tr><th>Référence</th><th>Date</th><th>Parcours</th><th>Client</th><th>Destination</th><th>Statut</th><th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/commandes/${o.id}`} className="font-mono text-titre underline">{o.reference}</Link></td>
                <td>{new Date(o.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{CHANNEL_LABELS[o.channel]}</td>
                <td>{o.company_name ?? o.customer_name}<br /><span className="text-xs text-encre/70">{o.customer_phone}</span></td>
                <td>{[o.ship_commune_name, o.ship_wilaya_name].filter(Boolean).join(", ") || "—"}</td>
                <td>{STATUS_LABELS[o.status]}</td>
                <td className="text-right">{formatMoney(Number(o.total_minor), o.currency)}{o.shipping_quote_status === "to_confirm" ? <span className="block text-xs text-erreur">livraison à confirmer</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex gap-3 text-sm" aria-label="Pagination">
        {page > 1 && <Link href={`/admin/commandes?${qs(page - 1)}`} className="underline">← Précédent</Link>}
        {(count ?? 0) > page * PAGE_SIZE && <Link href={`/admin/commandes?${qs(page + 1)}`} className="underline">Suivant →</Link>}
      </nav>
    </div>
  );
}
