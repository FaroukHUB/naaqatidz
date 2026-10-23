import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Commandes comptées dans le chiffre d'affaires : toutes sauf annulées et retournées. */
const EXCLUDED = new Set(["annulee", "retournee"]);
const DAY = 24 * 60 * 60 * 1000;
/** Les journées sont découpées à l'heure d'Alger (UTC+1, sans heure d'été). */
const ALGIERS_OFFSET = 60 * 60 * 1000;

export interface DayPoint {
  day: string; // AAAA-MM-JJ
  revenueMinor: number;
  orders: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenueMinor: number;
}

export interface Period {
  revenueMinor: number;
  orders: number;
  units: number;
}

export interface DashboardStats {
  days: DayPoint[];
  current: Period;
  previous: Period;
  today: { orders: number; revenueMinor: number };
  byChannel: { channel: "retail" | "reseller_dz"; revenueMinor: number; orders: number }[];
  france: { revenueMinor: number; orders: number; currency: string | null };
  top: TopProduct[];
  recent: { id: string; reference: string; created_at: string; channel: string; customer_name: string; company_name: string | null; status: string; total_minor: number; currency: string; shipping_quote_status: string }[];
  toConfirmShipping: number;
}

const dayKey = (iso: string) => new Date(new Date(iso).getTime() + ALGIERS_OFFSET).toISOString().slice(0, 10);

/**
 * Indicateurs du tableau de bord sur 2 × 30 jours, calculés à partir des commandes
 * (lues avec la session de l'administrateur, donc sous contrôle RLS).
 * Le chiffre d'affaires est celui des produits (hors frais de livraison, parfois « à confirmer »).
 */
export async function getDashboardStats(supabase: SupabaseClient, now = new Date()): Promise<DashboardStats> {
  const since = new Date(now.getTime() - 60 * DAY).toISOString();
  const [{ data: orders }, { data: recent }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, created_at, channel, status, currency, subtotal_minor, shipping_quote_status")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabase
      .from("orders")
      .select("id, reference, created_at, channel, customer_name, company_name, status, total_minor, currency, shipping_quote_status")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const rows = (orders ?? []).filter((o) => !EXCLUDED.has(o.status as string));
  const startCurrent = now.getTime() - 30 * DAY;

  // 30 dernières journées, y compris celles sans commande.
  const todayKey = dayKey(now.toISOString());
  const days: DayPoint[] = [];
  for (let i = 29; i >= 0; i--) days.push({ day: dayKey(new Date(now.getTime() - i * DAY).toISOString()), revenueMinor: 0, orders: 0 });
  const byDay = new Map(days.map((d) => [d.day, d]));

  const current: Period = { revenueMinor: 0, orders: 0, units: 0 };
  const previous: Period = { revenueMinor: 0, orders: 0, units: 0 };
  const today = { orders: 0, revenueMinor: 0 };
  const channels = { retail: { revenueMinor: 0, orders: 0 }, reseller_dz: { revenueMinor: 0, orders: 0 } };
  const france = { revenueMinor: 0, orders: 0, currency: null as string | null };
  const dzdCurrentIds: string[] = [];
  const unitsByOrder = new Map<string, "current" | "previous">();

  for (const o of rows) {
    const t = new Date(o.created_at as string).getTime();
    const isCurrent = t >= startCurrent;
    const amount = Number(o.subtotal_minor);
    if (o.channel === "reseller_fr") {
      if (isCurrent) {
        france.revenueMinor += amount;
        france.orders += 1;
        france.currency = o.currency as string;
      }
      continue;
    }
    const p = isCurrent ? current : previous;
    p.revenueMinor += amount;
    p.orders += 1;
    unitsByOrder.set(o.id as string, isCurrent ? "current" : "previous");
    if (isCurrent) {
      dzdCurrentIds.push(o.id as string);
      const ch = channels[o.channel as "retail" | "reseller_dz"];
      if (ch) {
        ch.revenueMinor += amount;
        ch.orders += 1;
      }
      const d = byDay.get(dayKey(o.created_at as string));
      if (d) {
        d.revenueMinor += amount;
        d.orders += 1;
      }
      if (dayKey(o.created_at as string) === todayKey) {
        today.orders += 1;
        today.revenueMinor += amount;
      }
    }
  }

  // Articles vendus et meilleures ventes (commandes DZD des 2 périodes).
  const ids = [...unitsByOrder.keys()];
  const top = new Map<string, TopProduct>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, product_name, quantity, line_total_minor")
      .in("order_id", ids.slice(i, i + 500));
    for (const it of items ?? []) {
      const period = unitsByOrder.get(it.order_id as string);
      const q = Number(it.quantity);
      if (period === "current") {
        current.units += q;
        const name = it.product_name as string;
        const entry = top.get(name) ?? { name, quantity: 0, revenueMinor: 0 };
        entry.quantity += q;
        entry.revenueMinor += Number(it.line_total_minor);
        top.set(name, entry);
      } else if (period === "previous") {
        previous.units += q;
      }
    }
  }

  const { count: toConfirmShipping } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shipping_quote_status", "to_confirm")
    .in("status", ["nouvelle", "confirmee", "en_preparation"]);

  return {
    days,
    current,
    previous,
    today,
    byChannel: [
      { channel: "reseller_dz", ...channels.reseller_dz },
      { channel: "retail", ...channels.retail },
    ],
    france,
    top: [...top.values()].sort((a, b) => b.quantity - a.quantity || b.revenueMinor - a.revenueMinor).slice(0, 8),
    recent: (recent ?? []) as DashboardStats["recent"],
    toConfirmShipping: toConfirmShipping ?? 0,
  };
}
