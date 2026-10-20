import type { Channel, Issue } from "./types";

/**
 * Livraison Algérie : configuration entièrement administrable.
 * Aucun tarif n'est supposé : sans tarif applicable, la livraison est « indisponible »
 * (ou « à confirmer » si l'administratrice l'autorise), jamais gratuite par défaut.
 */

export type BillingMode = "per_order" | "per_carton" | "weight_brackets";
export type ShippingAudience = Exclude<Channel, "reseller_fr">;

export interface WeightBracket {
  /** Borne haute incluse, en grammes. */
  maxWeightG: number;
  amountMinor: number;
}

export interface ShippingMethod {
  id: string;
  label: string;
  description: string | null;
  carrier: string | null;
  audiences: ShippingAudience[];
  active: boolean;
  sortOrder: number;
}

export interface ShippingRate {
  methodId: string;
  zoneId: string;
  billingMode: BillingMode;
  amountMinor: number | null;
  brackets: WeightBracket[] | null;
  active: boolean;
}

export interface ShippingConfig {
  wilayas: ReadonlyMap<string, { enabled: boolean; zoneId: string | null }>;
  communeOverrides: ReadonlyMap<string, { enabled: boolean | null; zoneId: string | null }>;
  methods: readonly ShippingMethod[];
  rates: readonly ShippingRate[];
}

export interface Destination {
  wilayaCode: string;
  communeCode: string;
}

export type ZoneResolution = { ok: true; zoneId: string } | { ok: false; issue: Issue };

export function resolveZone(config: ShippingConfig, dest: Destination): ZoneResolution {
  const wilaya = config.wilayas.get(dest.wilayaCode);
  const override = config.communeOverrides.get(dest.communeCode);
  const enabled = override?.enabled ?? wilaya?.enabled ?? false;
  if (!enabled) {
    return { ok: false, issue: { code: "destination_unavailable", message: "La livraison n'est pas encore proposée dans cette commune." } };
  }
  const zoneId = override?.zoneId ?? wilaya?.zoneId ?? null;
  if (!zoneId) {
    return { ok: false, issue: { code: "zone_missing", message: "Aucune zone tarifaire n'est configurée pour cette destination." } };
  }
  return { ok: true, zoneId };
}

export interface ShipmentMetrics {
  cartonCount: number | null;
  /** Poids total calculé (produits + tares si un plan de colisage existe), en grammes. */
  totalWeightG: number | null;
}

export type FeeResult = { ok: true; amountMinor: number } | { ok: false; issue: Issue };

export function computeFee(rate: ShippingRate, metrics: ShipmentMetrics): FeeResult {
  const incomplete: FeeResult = { ok: false, issue: { code: "rate_incomplete", message: "Le tarif de livraison est incomplet." } };
  switch (rate.billingMode) {
    case "per_order":
      return isAmount(rate.amountMinor) ? { ok: true, amountMinor: rate.amountMinor } : incomplete;
    case "per_carton":
      if (!isAmount(rate.amountMinor)) return incomplete;
      if (metrics.cartonCount === null) {
        return { ok: false, issue: { code: "needs_packing", message: "Le nombre de cartons n'a pas pu être calculé." } };
      }
      return { ok: true, amountMinor: rate.amountMinor * metrics.cartonCount };
    case "weight_brackets": {
      if (!rate.brackets || rate.brackets.length === 0 || !rate.brackets.every((b) => isAmount(b.amountMinor) && b.maxWeightG > 0)) {
        return incomplete;
      }
      if (metrics.totalWeightG === null) {
        return { ok: false, issue: { code: "needs_weight", message: "Le poids d'expédition de la commande n'a pas pu être calculé." } };
      }
      const bracket = [...rate.brackets].sort((a, b) => a.maxWeightG - b.maxWeightG).find((b) => metrics.totalWeightG! <= b.maxWeightG);
      if (!bracket) {
        return { ok: false, issue: { code: "no_bracket", message: "Aucune tranche de poids ne couvre cette commande." } };
      }
      return { ok: true, amountMinor: bracket.amountMinor };
    }
  }
}

function isAmount(n: number | null): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

export type ShippingOption =
  | { methodId: string; label: string; description: string | null; carrier: string | null; available: true; amountMinor: number; billingMode: BillingMode }
  | { methodId: string; label: string; description: string | null; carrier: string | null; available: false; issue: Issue };

/** Liste les modes de livraison proposés à ce parcours pour cette destination, avec leur montant. */
export function listShippingOptions(
  config: ShippingConfig,
  audience: ShippingAudience,
  dest: Destination,
  metrics: ShipmentMetrics,
): { zone: ZoneResolution; options: ShippingOption[] } {
  const zone = resolveZone(config, dest);
  const methods = config.methods
    .filter((m) => m.active && m.audiences.includes(audience))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "fr"));
  if (!zone.ok) return { zone, options: [] };
  const options: ShippingOption[] = methods.map((m) => {
    const base = { methodId: m.id, label: m.label, description: m.description, carrier: m.carrier };
    const rate = config.rates.find((r) => r.active && r.methodId === m.id && r.zoneId === zone.zoneId);
    if (!rate) {
      return { ...base, available: false, issue: { code: "no_rate", message: "Aucun tarif configuré pour cette zone." } };
    }
    const fee = computeFee(rate, metrics);
    return fee.ok ? { ...base, available: true, amountMinor: fee.amountMinor, billingMode: rate.billingMode } : { ...base, available: false, issue: fee.issue };
  });
  return { zone, options };
}
