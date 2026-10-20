import "server-only";
import { ORDER_STATUSES } from "@/lib/order-labels";
import { createSessionClient } from "@/lib/supabase/server";

export interface OrderFilters {
  q?: string;
  statut?: string;
  canal?: string;
  du?: string;
  au?: string;
  page?: string;
}

export const PAGE_SIZE = 50;

/** Requête des commandes pour l'administration (filtrée par la RLS : administrateurs uniquement). */
export async function queryOrders(filters: OrderFilters, columns: string, opts: { paginate: boolean }) {
  const supabase = await createSessionClient();
  let query = supabase.from("orders").select(columns, { count: "exact" }).order("created_at", { ascending: false });
  const q = (filters.q ?? "").replace(/[^\p{L}\p{N}\s+-]/gu, "").trim().slice(0, 60);
  if (q) query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q.replace(/\s/g, "")}%,company_name.ilike.%${q}%`);
  if (filters.statut && (ORDER_STATUSES as readonly string[]).includes(filters.statut)) query = query.eq("status", filters.statut);
  if (filters.canal && ["retail", "reseller_dz", "reseller_fr"].includes(filters.canal)) query = query.eq("channel", filters.canal);
  if (filters.du && /^\d{4}-\d{2}-\d{2}$/.test(filters.du)) query = query.gte("created_at", `${filters.du}T00:00:00Z`);
  if (filters.au && /^\d{4}-\d{2}-\d{2}$/.test(filters.au)) query = query.lte("created_at", `${filters.au}T23:59:59Z`);
  if (opts.paginate) {
    const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  } else {
    query = query.limit(5000);
  }
  return query;
}
