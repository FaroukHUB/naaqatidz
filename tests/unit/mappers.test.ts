import { describe, expect, it } from "vitest";
import { mapCatalogSkus, mapSkuViews } from "@/lib/catalog/mappers";

const product = {
  id: "p1",
  slug: "chantilly-al-atir",
  title: "Chantilly Al ʿĀtir",
  skus: [
    { sku: "CHA-ATIR-25-MONOI", label: "25 g", scent: "Monoï", priceDzd: 400, netContent: null, saleable: true, shippingWeightG: null },
    { sku: "CHA-ATIR-25", label: "25 g", priceDzd: 400, netContent: null, saleable: true, shippingWeightG: null },
  ],
};

describe("senteurs", () => {
  it("ajoute la senteur au libellé de la référence commandée", () => {
    expect(mapCatalogSkus([product]).map((s) => s.variantLabel)).toEqual(["25 g — Monoï", "25 g"]);
  });

  it("expose la senteur séparément pour la fiche produit", () => {
    expect(mapSkuViews(product).map((s) => s.scent)).toEqual(["Monoï", null]);
  });
});
