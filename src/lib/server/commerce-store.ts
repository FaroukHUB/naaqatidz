import type { PrivatePrice } from "@/lib/domain/pricing";
import type { BillingMode, ShippingAudience, ShippingConfig, WeightBracket } from "@/lib/domain/shipping";
import type { CommerceSettings } from "@/lib/domain/types";

/** Accès aux données commerciales privées. Implémenté avec Supabase (serveur) et PostgreSQL direct (tests). */
export interface CommerceStore {
  getSettings(): Promise<CommerceSettings>;
  getShippingConfig(): Promise<ShippingConfig>;
  /** Tarifs France : à n'appeler qu'après avoir vérifié côté serveur que le compte est un revendeur France actif. */
  getFrancePrices(skus: readonly string[]): Promise<Map<string, PrivatePrice>>;
  createOrder(payload: OrderPayload): Promise<{ orderId: string; reference: string; created: boolean }>;
  consumeRateLimit(bucket: string, keyHash: string, windowSeconds: number, max: number): Promise<boolean>;
}

export interface OrderPayload {
  channel: "retail" | "reseller_dz" | "reseller_fr";
  user_id: string | null;
  payment_method: "cod" | "a_definir";
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  company_name: string | null;
  ship_country: string;
  ship_wilaya_code: string | null;
  ship_wilaya_name: string | null;
  ship_commune_code: string | null;
  ship_commune_name: string | null;
  ship_city: string | null;
  ship_postal_code: string | null;
  ship_address: string;
  ship_notes: string | null;
  currency: string;
  subtotal_minor: number;
  shipping_minor: number | null;
  shipping_quote_status: "quoted" | "to_confirm" | "not_applicable";
  shipping_method_id: string | null;
  shipping_method_label: string | null;
  carrier: string | null;
  conditions: Record<string, unknown>;
  packing_status: "not_required" | "calculated";
  packing_plan: unknown;
  idempotency_key: string;
  request_hash: string;
  confirmation_token_hash: string | null;
  items: {
    sku: string;
    product_id: string;
    product_name: string;
    variant_label: string | null;
    unit_price_minor: number;
    quantity: number;
    unit_weight_g: number | null;
  }[];
}

// --- Conversion des lignes SQL vers les types métier (partagé par toutes les implémentations) ---

export interface SettingsRow {
  retail_max_units_per_sku: number;
  carton_max_units_per_sku: number;
  carton_max_weight_g: number;
  carton_tare_g: number | null;
  carton_safety_margin_g: number | null;
  allow_orders_without_shipping_rate: boolean;
  fr_orders_enabled: boolean;
  fr_currency: string | null;
  fr_payment_terms: string | null;
  fr_shipping_terms: string | null;
  fr_shipping_fee_mode: "on_quote" | "fixed" | null;
  fr_shipping_fee_minor: number | string | null;
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
const text = (v: string | null) => (v && v.trim() ? v.trim() : null);

export function mapSettings(row: SettingsRow): CommerceSettings {
  return {
    retailMaxUnitsPerSku: row.retail_max_units_per_sku,
    packing: {
      maxUnitsPerSkuPerCarton: row.carton_max_units_per_sku,
      maxCartonWeightG: row.carton_max_weight_g,
      cartonTareG: row.carton_tare_g,
      safetyMarginG: row.carton_safety_margin_g,
    },
    allowOrdersWithoutShippingRate: row.allow_orders_without_shipping_rate,
    france: {
      ordersEnabled: row.fr_orders_enabled,
      currency: text(row.fr_currency),
      paymentTerms: text(row.fr_payment_terms),
      shippingTerms: text(row.fr_shipping_terms),
      shippingFeeMode: row.fr_shipping_fee_mode,
      shippingFeeMinor: num(row.fr_shipping_fee_minor),
    },
  };
}

export interface ShippingRows {
  wilayas: { wilaya_code: string; enabled: boolean; zone_id: string | null }[];
  communes: { commune_code: string; enabled: boolean | null; zone_id: string | null }[];
  methods: { id: string; label: string; description: string | null; carrier: string | null; audiences: string[] | string; active: boolean; sort_order: number }[];
  rates: { method_id: string; zone_id: string; billing_mode: BillingMode; amount_minor: number | string | null; brackets: WeightBracket[] | null; active: boolean }[];
}

/** pg renvoie parfois les tableaux d'enum sous forme littérale « {a,b} ». */
function parseArray(v: string[] | string): string[] {
  if (Array.isArray(v)) return v;
  return v.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
}

export function mapShipping(rows: ShippingRows): ShippingConfig {
  return {
    wilayas: new Map(rows.wilayas.map((w) => [w.wilaya_code, { enabled: w.enabled, zoneId: w.zone_id }])),
    communeOverrides: new Map(rows.communes.map((c) => [c.commune_code, { enabled: c.enabled, zoneId: c.zone_id }])),
    methods: rows.methods.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      carrier: m.carrier,
      audiences: parseArray(m.audiences).filter((a): a is ShippingAudience => a === "retail" || a === "reseller_dz"),
      active: m.active,
      sortOrder: m.sort_order,
    })),
    rates: rows.rates.map((r) => ({
      methodId: r.method_id,
      zoneId: r.zone_id,
      billingMode: r.billing_mode,
      amountMinor: num(r.amount_minor),
      brackets: r.brackets ? r.brackets.map((b) => ({ maxWeightG: Number(b.maxWeightG), amountMinor: Number(b.amountMinor) })) : null,
      active: r.active,
    })),
  };
}
