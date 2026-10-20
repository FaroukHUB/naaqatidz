import { describe, expect, it } from "vitest";
import { buildQuote } from "@/lib/domain/quote";
import { aggregateLines } from "@/lib/domain/cart";
import { catalogOf, settings, shippingConfig, sku } from "./fixtures";

const catalog = catalogOf(
  sku("SAV-A", { priceDzdMinor: 80_000, shippingWeightG: 150 }),
  sku("SAV-B", { priceDzdMinor: 120_000, shippingWeightG: 900 }),
  sku("LAIT", { saleable: false }),
  sku("SANS-PRIX", { priceDzdMinor: null }),
  sku("SANS-POIDS", { shippingWeightG: null }),
);
const dest = { wilayaCode: "16", communeCode: "1601" };

describe("panier", () => {
  it("cumule les lignes d'un même SKU", () => {
    const r = aggregateLines([
      { sku: "A", quantity: 2 },
      { sku: "B", quantity: 1 },
      { sku: "A", quantity: 4 },
    ]);
    expect(r.items).toEqual([
      { sku: "A", quantity: 6 },
      { sku: "B", quantity: 1 },
    ]);
  });
  it("refuse quantités non entières, nulles ou négatives", () => {
    for (const q of [0, -1, 1.5, Number.NaN]) {
      expect(aggregateLines([{ sku: "A", quantity: q }]).issues[0]!.code).toBe("invalid_quantity");
    }
  });
});

describe("parcours particulier", () => {
  it("commande sans compte : prix publics DZD, livraison configurée, total recalculé", () => {
    const q = buildQuote({
      channel: "retail",
      lines: [{ sku: "SAV-A", quantity: 2 }, { sku: "SAV-B", quantity: 1 }],
      catalog,
      settings: settings(),
      shipping: { config: shippingConfig(), destination: dest, methodId: null },
    });
    expect(q.canOrder).toBe(true);
    expect(q.currency).toBe("DZD");
    expect(q.subtotalMinor).toBe(2 * 80_000 + 120_000);
    expect(q.shippingMinor).toBe(50_000);
    expect(q.totalMinor).toBe(330_000);
    expect(q.totalIsFinal).toBe(true);
  });

  it("5 unités d'un SKU acceptées, 6 refusées", () => {
    const ok = buildQuote({ channel: "retail", lines: [{ sku: "SAV-A", quantity: 5 }], catalog, settings: settings(), shipping: { config: shippingConfig(), destination: dest, methodId: null } });
    expect(ok.canOrder).toBe(true);
    const ko = buildQuote({ channel: "retail", lines: [{ sku: "SAV-A", quantity: 6 }], catalog, settings: settings(), shipping: { config: shippingConfig(), destination: dest, methodId: null } });
    expect(ko.canOrder).toBe(false);
    expect(ko.blockers.map((b) => b.code)).toContain("retail_limit_exceeded");
  });

  it("limite de 5 appliquée au cumul de plusieurs lignes identiques", () => {
    const q = buildQuote({
      channel: "retail",
      lines: [{ sku: "SAV-A", quantity: 3 }, { sku: "SAV-B", quantity: 1 }, { sku: "SAV-A", quantity: 3 }],
      catalog,
      settings: settings(),
      shipping: { config: shippingConfig(), destination: dest, methodId: null },
    });
    expect(q.canOrder).toBe(false);
    expect(q.blockers.find((b) => b.code === "retail_limit_exceeded")?.sku).toBe("SAV-A");
  });

  it("références non vendables ou sans prix refusées, sans prix nul", () => {
    const q = buildQuote({ channel: "retail", lines: [{ sku: "LAIT", quantity: 1 }, { sku: "SANS-PRIX", quantity: 1 }, { sku: "INCONNU", quantity: 1 }], catalog, settings: settings(), shipping: { config: shippingConfig(), destination: dest, methodId: null } });
    expect(q.canOrder).toBe(false);
    expect(q.lines).toHaveLength(0);
    expect(q.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(["not_saleable", "price_missing", "unknown_sku"]));
  });

  it("livraison non configurée : commande bloquée, jamais présentée comme gratuite", () => {
    const q = buildQuote({ channel: "retail", lines: [{ sku: "SAV-A", quantity: 1 }], catalog, settings: settings(), shipping: { config: shippingConfig({ rates: [] }), destination: dest, methodId: null } });
    expect(q.canOrder).toBe(false);
    expect(q.shippingMinor).toBeNull();
    expect(q.totalIsFinal).toBe(false);
    expect(q.shipping.status).toBe("unavailable");
  });

  it("livraison non configurée mais autorisée « à confirmer » : total marqué provisoire", () => {
    const q = buildQuote({ channel: "retail", lines: [{ sku: "SAV-A", quantity: 1 }], catalog, settings: settings({ allowOrdersWithoutShippingRate: true }), shipping: { config: shippingConfig({ rates: [] }), destination: dest, methodId: null } });
    expect(q.canOrder).toBe(true);
    expect(q.shipping.status).toBe("to_confirm");
    expect(q.totalIsFinal).toBe(false);
    expect(q.totalMinor).toBe(80_000);
  });

  it("destination désactivée (wilaya ou commune) : refus même si « à confirmer » est autorisé", () => {
    for (const d of [{ wilayaCode: "01", communeCode: "0101" }, { wilayaCode: "16", communeCode: "1602" }, { wilayaCode: "99", communeCode: "9901" }]) {
      const q = buildQuote({ channel: "retail", lines: [{ sku: "SAV-A", quantity: 1 }], catalog, settings: settings({ allowOrdersWithoutShippingRate: true }), shipping: { config: shippingConfig(), destination: d, methodId: null } });
      expect(q.canOrder).toBe(false);
      expect(q.blockers.map((b) => b.code)).toContain("destination_unavailable");
    }
  });

  it("tarif par tranches de poids et poids manquant", () => {
    const config = shippingConfig({
      rates: [{ methodId: "m-home", zoneId: "z1", billingMode: "weight_brackets", amountMinor: null, brackets: [{ maxWeightG: 1000, amountMinor: 40_000 }, { maxWeightG: 5000, amountMinor: 70_000 }], active: true }],
    });
    const q = buildQuote({ channel: "retail", lines: [{ sku: "SAV-B", quantity: 2 }], catalog, settings: settings(), shipping: { config, destination: dest, methodId: null } });
    expect(q.shippingMinor).toBe(70_000); // 1 800 g
    const missing = buildQuote({ channel: "retail", lines: [{ sku: "SANS-POIDS", quantity: 1 }], catalog, settings: settings(), shipping: { config, destination: dest, methodId: null } });
    expect(missing.canOrder).toBe(false);
    expect(missing.blockers.map((b) => b.code)).toContain("needs_weight");
  });

  it("plusieurs modes : le choix est obligatoire ; mode inconnu refusé", () => {
    const config = shippingConfig({
      methods: [
        { id: "m-home", label: "Domicile", description: null, carrier: null, audiences: ["retail"], active: true, sortOrder: 1 },
        { id: "m-desk", label: "Point relais", description: null, carrier: null, audiences: ["retail"], active: true, sortOrder: 2 },
      ],
      rates: [
        { methodId: "m-home", zoneId: "z1", billingMode: "per_order", amountMinor: 60_000, brackets: null, active: true },
        { methodId: "m-desk", zoneId: "z1", billingMode: "per_order", amountMinor: 40_000, brackets: null, active: true },
      ],
    });
    const base = { channel: "retail" as const, lines: [{ sku: "SAV-A", quantity: 1 }], catalog, settings: settings() };
    expect(buildQuote({ ...base, shipping: { config, destination: dest, methodId: null } }).shipping.status).toBe("choose_method");
    expect(buildQuote({ ...base, shipping: { config, destination: dest, methodId: "m-desk" } }).shippingMinor).toBe(40_000);
    expect(buildQuote({ ...base, shipping: { config, destination: dest, methodId: "nope" } }).canOrder).toBe(false);
  });
});

describe("revendeur Algérie", () => {
  const perCarton = shippingConfig({ rates: [{ methodId: "m-home", zoneId: "z1", billingMode: "per_carton", amountMinor: 70_000, brackets: null, active: true }] });

  it("prix publics, pas de limite de 5, colisage et livraison par carton", () => {
    const q = buildQuote({ channel: "reseller_dz", lines: [{ sku: "SAV-A", quantity: 25 }], catalog, settings: settings(), shipping: { config: perCarton, destination: dest, methodId: null } });
    expect(q.canOrder).toBe(true);
    expect(q.lines[0]!.unitPriceMinor).toBe(80_000);
    expect(q.packing?.cartons).toHaveLength(3);
    expect(q.shippingMinor).toBe(3 * 70_000);
    expect(q.totalMinor).toBe(25 * 80_000 + 210_000);
  });

  it("poids manquant : commande bloquée avec explication", () => {
    const q = buildQuote({ channel: "reseller_dz", lines: [{ sku: "SANS-POIDS", quantity: 3 }], catalog, settings: settings(), shipping: { config: perCarton, destination: dest, methodId: null } });
    expect(q.canOrder).toBe(false);
    expect(q.packingIssues.map((i) => i.code)).toContain("weight_missing");
  });

  it("tare non configurée : colisage non validé", () => {
    const s = settings();
    s.packing.cartonTareG = null;
    const q = buildQuote({ channel: "reseller_dz", lines: [{ sku: "SAV-A", quantity: 3 }], catalog, settings: s, shipping: { config: perCarton, destination: dest, methodId: null } });
    expect(q.canOrder).toBe(false);
    expect(q.packing).toBeNull();
  });
});

describe("revendeur France", () => {
  const fr = new Map([["SAV-A", { unitPriceMinor: 450, currency: "EUR" }]]);
  const frOpen = settings({ france: { ordersEnabled: true, currency: "EUR", paymentTerms: "Virement", shippingTerms: "France métropolitaine", shippingFeeMode: "on_quote", shippingFeeMinor: null } });

  it("conditions non configurées : panier calculable, commande refusée avec la liste des manques", () => {
    const s = settings({ france: { ...settings().france, currency: "EUR" } });
    const q = buildQuote({ channel: "reseller_fr", lines: [{ sku: "SAV-A", quantity: 3 }], catalog, settings: s, francePrices: fr });
    expect(q.lines).toHaveLength(1);
    expect(q.subtotalMinor).toBe(1350);
    expect(q.canOrder).toBe(false);
    expect(q.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(["fr_payment_terms_missing", "fr_shipping_terms_missing", "fr_orders_disabled"]));
  });

  it("tarif France manquant : jamais de repli sur le prix algérien ni sur zéro", () => {
    const q = buildQuote({ channel: "reseller_fr", lines: [{ sku: "SAV-B", quantity: 1 }], catalog, settings: frOpen, francePrices: fr });
    expect(q.lines).toHaveLength(0);
    expect(q.canOrder).toBe(false);
    expect(q.blockers[0]!.code).toBe("price_missing");
    const zero = buildQuote({ channel: "reseller_fr", lines: [{ sku: "SAV-A", quantity: 1 }], catalog, settings: frOpen, francePrices: new Map([["SAV-A", { unitPriceMinor: 0, currency: "EUR" }]]) });
    expect(zero.canOrder).toBe(false);
  });

  it("devise incohérente refusée", () => {
    const q = buildQuote({ channel: "reseller_fr", lines: [{ sku: "SAV-A", quantity: 1 }], catalog, settings: frOpen, francePrices: new Map([["SAV-A", { unitPriceMinor: 450, currency: "USD" }]]) });
    expect(q.blockers.map((b) => b.code)).toContain("currency_mismatch");
  });

  it("conditions validées : commande possible, total hors expédition non définitif", () => {
    const q = buildQuote({ channel: "reseller_fr", lines: [{ sku: "SAV-A", quantity: 30 }], catalog, settings: frOpen, francePrices: fr });
    expect(q.canOrder).toBe(true);
    expect(q.currency).toBe("EUR");
    expect(q.totalIsFinal).toBe(false);
    expect(q.packing).toBeNull();
  });
});
