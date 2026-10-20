import type { CartItem, CatalogSku, Channel, Issue } from "./types";

export interface PrivatePrice {
  unitPriceMinor: number;
  currency: string;
}

export interface PricedLine {
  sku: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
  shippingWeightG: number | null;
}

export interface PricingInput {
  channel: Channel;
  items: readonly CartItem[];
  catalog: ReadonlyMap<string, CatalogSku>;
  /** Limite de pièces par référence pour les particuliers (règle cliente : 5). */
  retailMaxUnitsPerSku: number;
  /** Tarifs revendeurs France, chargés uniquement pour un compte France validé. */
  francePrices?: ReadonlyMap<string, PrivatePrice>;
  /** Devise configurée pour la France ; null tant qu'elle n'est pas confirmée. */
  franceCurrency?: string | null;
}

export interface PricingResult {
  currency: string | null;
  lines: PricedLine[];
  subtotalMinor: number;
  issues: Issue[];
}

/**
 * Calcule les lignes et le sous-total à partir des seules données autorisées.
 * Le navigateur ne fournit que des SKU et des quantités : aucun prix venant du client n'est utilisé.
 */
export function priceItems(input: PricingInput): PricingResult {
  const { channel, items, catalog } = input;
  const issues: Issue[] = [];
  const lines: PricedLine[] = [];
  const currency = channel === "reseller_fr" ? (input.franceCurrency ?? null) : "DZD";

  if (channel === "reseller_fr" && !currency) {
    issues.push({ code: "fr_currency_missing", message: "La devise des tarifs revendeurs France n'est pas encore configurée." });
  }

  for (const item of items) {
    const sku = catalog.get(item.sku);
    if (!sku) {
      issues.push({ code: "unknown_sku", message: "Cette référence n'existe pas ou n'est plus publiée.", sku: item.sku });
      continue;
    }
    if (!sku.saleable) {
      issues.push({ code: "not_saleable", message: `« ${label(sku)} » n'est pas disponible à la vente en ligne.`, sku: item.sku });
      continue;
    }
    if (channel === "retail" && item.quantity > input.retailMaxUnitsPerSku) {
      issues.push({
        code: "retail_limit_exceeded",
        message: `Maximum ${input.retailMaxUnitsPerSku} pièces par référence : « ${label(sku)} » (${item.quantity} demandées).`,
        sku: item.sku,
      });
    }

    let unitPriceMinor: number | null = null;
    if (channel === "reseller_fr") {
      const price = input.francePrices?.get(item.sku);
      // Jamais de repli sur le prix algérien ni sur un prix nul.
      if (!price || !Number.isInteger(price.unitPriceMinor) || price.unitPriceMinor <= 0) {
        issues.push({ code: "price_missing", message: `Tarif revendeur France non configuré pour « ${label(sku)} ».`, sku: item.sku });
        continue;
      }
      if (currency && price.currency !== currency) {
        issues.push({ code: "currency_mismatch", message: `Devise incohérente pour « ${label(sku)} ».`, sku: item.sku });
        continue;
      }
      unitPriceMinor = price.unitPriceMinor;
    } else {
      if (sku.priceDzdMinor === null || !Number.isInteger(sku.priceDzdMinor) || sku.priceDzdMinor <= 0) {
        issues.push({ code: "price_missing", message: `Prix non renseigné pour « ${label(sku)} ».`, sku: item.sku });
        continue;
      }
      unitPriceMinor = sku.priceDzdMinor;
    }

    lines.push({
      sku: sku.sku,
      productId: sku.productId,
      productSlug: sku.productSlug,
      productName: sku.productName,
      variantLabel: sku.variantLabel,
      quantity: item.quantity,
      unitPriceMinor,
      lineTotalMinor: unitPriceMinor * item.quantity,
      currency: currency ?? "",
      shippingWeightG: sku.shippingWeightG,
    });
  }

  const subtotalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  if (!Number.isSafeInteger(subtotalMinor)) {
    issues.push({ code: "amount_overflow", message: "Montant hors limites." });
  }
  return { currency, lines, subtotalMinor, issues };
}

export function label(sku: Pick<CatalogSku, "productName" | "variantLabel">): string {
  return sku.variantLabel ? `${sku.productName} — ${sku.variantLabel}` : sku.productName;
}
