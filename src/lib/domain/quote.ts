import { aggregateLines } from "./cart";
import { computePackingPlan, type PackingPlan } from "./packing";
import { priceItems, type PricedLine, type PrivatePrice } from "./pricing";
import { listShippingOptions, type BillingMode, type Destination, type ShippingConfig, type ShippingOption } from "./shipping";
import type { CartLineInput, CatalogSku, Channel, CommerceSettings, Issue } from "./types";

export interface QuoteInput {
  channel: Channel;
  lines: readonly CartLineInput[];
  catalog: ReadonlyMap<string, CatalogSku>;
  settings: CommerceSettings;
  francePrices?: ReadonlyMap<string, PrivatePrice>;
  /** Livraison Algérie (particuliers et revendeurs Algérie). */
  shipping?: { config: ShippingConfig; destination: Destination | null; methodId: string | null };
}

export type ShippingSelection =
  | { status: "pending_destination" }
  | { status: "quoted"; methodId: string; label: string; carrier: string | null; billingMode: BillingMode; amountMinor: number }
  | { status: "to_confirm"; methodId: string | null; label: string | null; reason: string }
  | { status: "unavailable"; issue: Issue }
  | { status: "choose_method" }
  | { status: "fr_fixed"; amountMinor: number }
  | { status: "fr_on_quote" }
  | { status: "fr_not_configured" };

export interface Quote {
  channel: Channel;
  currency: string | null;
  lines: PricedLine[];
  subtotalMinor: number;
  packing: PackingPlan | null;
  packingIssues: Issue[];
  shippingOptions: ShippingOption[];
  shipping: ShippingSelection;
  shippingMinor: number | null;
  totalMinor: number;
  /** false si la livraison reste à confirmer : le total ne doit pas être présenté comme définitif. */
  totalIsFinal: boolean;
  canOrder: boolean;
  blockers: Issue[];
}

export function franceMissingTerms(settings: CommerceSettings): Issue[] {
  const fr = settings.france;
  const missing: Issue[] = [];
  if (!fr.currency) missing.push({ code: "fr_currency_missing", message: "Devise des tarifs France à confirmer." });
  if (!fr.paymentTerms) missing.push({ code: "fr_payment_terms_missing", message: "Conditions de paiement France à confirmer." });
  if (!fr.shippingTerms) missing.push({ code: "fr_shipping_terms_missing", message: "Conditions et destinations d'expédition France à confirmer." });
  if (!fr.shippingFeeMode || (fr.shippingFeeMode === "fixed" && (fr.shippingFeeMinor === null || fr.shippingFeeMinor < 0))) {
    missing.push({ code: "fr_shipping_fee_missing", message: "Mode de calcul des frais d'expédition France à confirmer." });
  }
  if (!fr.ordersEnabled) {
    missing.push({ code: "fr_orders_disabled", message: "Les commandes fermes France ne sont pas encore ouvertes par Naaqati." });
  }
  return missing;
}

export function buildQuote(input: QuoteInput): Quote {
  const { channel, settings } = input;
  const blockers: Issue[] = [];
  const agg = aggregateLines(input.lines);
  blockers.push(...agg.issues);

  const pricing = priceItems({
    channel,
    items: agg.items,
    catalog: input.catalog,
    retailMaxUnitsPerSku: settings.retailMaxUnitsPerSku,
    francePrices: input.francePrices,
    franceCurrency: settings.france.currency,
  });
  blockers.push(...pricing.issues);

  // Colisage : obligatoire pour les revendeurs Algérie (enregistré avec la commande).
  let packing: PackingPlan | null = null;
  let packingIssues: Issue[] = [];
  if (channel === "reseller_dz" && pricing.lines.length > 0) {
    const result = computePackingPlan(
      pricing.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitWeightG: l.shippingWeightG, label: l.variantLabel ? `${l.productName} — ${l.variantLabel}` : l.productName })),
      settings.packing,
    );
    if (result.ok) packing = result.plan;
    else {
      packingIssues = result.issues;
      blockers.push(...result.issues);
    }
  }

  let shipping: ShippingSelection;
  let shippingOptions: ShippingOption[] = [];

  if (channel === "reseller_fr") {
    const missing = franceMissingTerms(settings);
    blockers.push(...missing);
    const fr = settings.france;
    if (fr.shippingFeeMode === "fixed" && fr.shippingFeeMinor !== null && fr.shippingFeeMinor >= 0) {
      shipping = { status: "fr_fixed", amountMinor: fr.shippingFeeMinor };
    } else if (fr.shippingFeeMode === "on_quote") {
      shipping = { status: "fr_on_quote" };
    } else {
      shipping = { status: "fr_not_configured" };
    }
  } else if (!input.shipping || !input.shipping.destination) {
    shipping = { status: "pending_destination" };
    blockers.push({ code: "destination_required", message: "Indiquez la wilaya et la commune de livraison." });
  } else {
    const allItemsWeighted = pricing.lines.length > 0 && pricing.lines.every((l) => l.shippingWeightG !== null && l.shippingWeightG > 0);
    const metrics = {
      cartonCount: packing ? packing.cartons.length : null,
      totalWeightG: packing
        ? packing.totalGrossWeightG
        : allItemsWeighted
          ? pricing.lines.reduce((s, l) => s + (l.shippingWeightG as number) * l.quantity, 0)
          : null,
    };
    const { zone, options } = listShippingOptions(input.shipping.config, channel, input.shipping.destination, metrics);
    shippingOptions = options;
    const available = options.filter((o) => o.available);
    const requested = input.shipping.methodId ? options.find((o) => o.methodId === input.shipping!.methodId) : undefined;
    const chosen =
      requested ??
      (input.shipping.methodId ? undefined : available.length === 1 ? available[0] : options.length === 1 ? options[0] : undefined);

    if (!zone.ok) {
      // Destination non desservie : jamais de commande avec une livraison inventée.
      if (zone.issue.code === "zone_missing" && settings.allowOrdersWithoutShippingRate) {
        shipping = { status: "to_confirm", methodId: null, label: null, reason: zone.issue.message };
      } else {
        shipping = { status: "unavailable", issue: zone.issue };
        blockers.push(zone.issue);
      }
    } else if (chosen && chosen.available) {
      shipping = { status: "quoted", methodId: chosen.methodId, label: chosen.label, carrier: chosen.carrier, billingMode: chosen.billingMode, amountMinor: chosen.amountMinor };
    } else if (input.shipping.methodId && !requested) {
      shipping = { status: "unavailable", issue: { code: "unknown_method", message: "Mode de livraison inconnu." } };
      blockers.push(shipping.issue);
    } else if (!chosen && available.length > 1) {
      shipping = { status: "choose_method" };
      blockers.push({ code: "method_required", message: "Choisissez un mode de livraison." });
    } else if (settings.allowOrdersWithoutShippingRate) {
      const reason = chosen && !chosen.available ? chosen.issue.message : "Aucun tarif de livraison configuré pour cette destination.";
      shipping = { status: "to_confirm", methodId: chosen?.methodId ?? null, label: chosen?.label ?? null, reason };
    } else {
      const issue: Issue =
        chosen && !chosen.available
          ? chosen.issue
          : { code: "shipping_unavailable", message: "Aucun mode de livraison n'est disponible pour cette destination pour le moment." };
      shipping = { status: "unavailable", issue };
      blockers.push(issue);
    }
  }

  const shippingMinor = shipping.status === "quoted" || shipping.status === "fr_fixed" ? shipping.amountMinor : null;
  const totalMinor = pricing.subtotalMinor + (shippingMinor ?? 0);
  const totalIsFinal = shippingMinor !== null;
  const canOrder = blockers.length === 0 && pricing.lines.length > 0;

  return {
    channel,
    currency: pricing.currency,
    lines: pricing.lines,
    subtotalMinor: pricing.subtotalMinor,
    packing,
    packingIssues,
    shippingOptions,
    shipping,
    shippingMinor,
    totalMinor,
    totalIsFinal,
    canOrder,
    blockers,
  };
}
