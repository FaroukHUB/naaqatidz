import type { CatalogSku, CommerceSettings } from "@/lib/domain/types";
import type { ShippingConfig } from "@/lib/domain/shipping";

// Données de test uniquement : aucune valeur commerciale réelle.
export function sku(code: string, over: Partial<CatalogSku> = {}): CatalogSku {
  return {
    sku: code,
    productId: `p-${code}`,
    productSlug: `produit-${code.toLowerCase()}`,
    productName: `Produit ${code}`,
    variantLabel: null,
    priceDzdMinor: 100_000,
    shippingWeightG: 200,
    saleable: true,
    ...over,
  };
}

export function catalogOf(...skus: CatalogSku[]) {
  return new Map(skus.map((s) => [s.sku, s]));
}

export function settings(over: Partial<CommerceSettings> = {}): CommerceSettings {
  return {
    retailMaxUnitsPerSku: 5,
    packing: { maxUnitsPerSkuPerCarton: 10, maxCartonWeightG: 10_000, cartonTareG: 300, safetyMarginG: 200 },
    allowOrdersWithoutShippingRate: false,
    france: { ordersEnabled: false, currency: null, paymentTerms: null, shippingTerms: null, shippingFeeMode: null, shippingFeeMinor: null },
    ...over,
  };
}

export function shippingConfig(over: Partial<ShippingConfig> = {}): ShippingConfig {
  return {
    wilayas: new Map([
      ["16", { enabled: true, zoneId: "z1" }],
      ["31", { enabled: true, zoneId: null }],
      ["01", { enabled: false, zoneId: "z1" }],
    ]),
    communeOverrides: new Map([["1602", { enabled: false, zoneId: null }]]),
    methods: [
      { id: "m-home", label: "Domicile", description: null, carrier: null, audiences: ["retail", "reseller_dz"], active: true, sortOrder: 1 },
    ],
    rates: [{ methodId: "m-home", zoneId: "z1", billingMode: "per_order", amountMinor: 50_000, brackets: null, active: true }],
    ...over,
  };
}
