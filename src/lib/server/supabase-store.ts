import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { mapSettings, mapShipping, type CommerceStore, type SettingsRow } from "./commerce-store";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Base de données : ${res.error.message}`);
  return res.data;
}

/** Implémentation Supabase (clé secrète, serveur uniquement). */
export function createSupabaseStore(): CommerceStore {
  const db = createServiceClient();
  return {
    async getSettings() {
      const row = check(await db.from("commerce_settings").select("*").eq("id", 1).single());
      return mapSettings(row as SettingsRow);
    },
    async getShippingConfig() {
      const [wilayas, communes, methods, rates] = await Promise.all([
        db.from("shipping_wilaya_settings").select("wilaya_code, enabled, zone_id"),
        db.from("shipping_commune_overrides").select("commune_code, enabled, zone_id"),
        db.from("shipping_methods").select("id, label, description, carrier, audiences, active, sort_order"),
        db.from("shipping_rates").select("method_id, zone_id, billing_mode, amount_minor, brackets, active"),
      ]);
      return mapShipping({ wilayas: check(wilayas), communes: check(communes), methods: check(methods), rates: check(rates) });
    },
    async getFrancePrices(skus) {
      if (skus.length === 0) return new Map();
      const rows = check(await db.from("reseller_prices").select("sku, unit_price_minor, currency").eq("market", "FR").in("sku", [...skus]));
      return new Map(rows.map((r) => [r.sku as string, { unitPriceMinor: Number(r.unit_price_minor), currency: r.currency as string }]));
    },
    async createOrder(payload) {
      const rows = check(await db.rpc("create_order", { p: payload }));
      const row = (rows as { order_id: string; reference: string; created: boolean }[])[0];
      if (!row) throw new Error("Création de commande sans résultat.");
      return { orderId: row.order_id, reference: row.reference, created: row.created };
    },
    async consumeRateLimit(bucket, keyHash, windowSeconds, max) {
      const ok = check(await db.rpc("consume_rate_limit", { p_bucket: bucket, p_key_hash: keyHash, p_window_seconds: windowSeconds, p_max: max }));
      return ok === true;
    },
  };
}
