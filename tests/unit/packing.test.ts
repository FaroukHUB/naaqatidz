import { describe, expect, it } from "vitest";
import { computePackingPlan, validateManualPlan, type PackingPlan } from "@/lib/domain/packing";
import type { PackingConfig } from "@/lib/domain/types";

const config: PackingConfig = { maxUnitsPerSkuPerCarton: 10, maxCartonWeightG: 10_000, cartonTareG: 300, safetyMarginG: 200 };
// Capacité utile = 10 000 − 300 − 200 = 9 500 g

function assertValid(plan: PackingPlan, cfg = config) {
  for (const carton of plan.cartons) {
    expect(carton.itemsWeightG + (cfg.cartonTareG ?? 0) + (cfg.safetyMarginG ?? 0)).toBeLessThanOrEqual(cfg.maxCartonWeightG);
    for (const c of carton.contents) expect(c.quantity).toBeLessThanOrEqual(cfg.maxUnitsPerSkuPerCarton);
  }
}
function units(plan: PackingPlan, sku: string) {
  return plan.cartons.flatMap((c) => c.contents).filter((c) => c.sku === sku).reduce((s, c) => s + c.quantity, 0);
}

describe("colisage revendeurs Algérie", () => {
  it("11 unités d'un même SKU : 2 cartons", () => {
    const r = computePackingPlan([{ sku: "A", quantity: 11, unitWeightG: 100 }], config);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.cartons).toHaveLength(2);
    expect(r.plan.cartons.map((c) => c.contents[0]!.quantity)).toEqual([10, 1]);
    assertValid(r.plan);
  });

  it("21 unités : 3 cartons", () => {
    const r = computePackingPlan([{ sku: "A", quantity: 21, unitWeightG: 100 }], config);
    expect(r.ok && r.plan.cartons.length).toBe(3);
  });

  it("10 A + 10 B dans le même carton si le poids le permet", () => {
    const r = computePackingPlan(
      [
        { sku: "A", quantity: 10, unitWeightG: 300 },
        { sku: "B", quantity: 10, unitWeightG: 250 },
      ],
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.cartons).toHaveLength(1);
    expect(r.plan.cartons[0]!.itemsWeightG).toBe(5500);
    expect(r.plan.cartons[0]!.grossWeightG).toBe(5800);
    expect(r.plan.provedMinimal).toBe(true);
  });

  it("plusieurs références légères regroupées", () => {
    const items = ["A", "B", "C", "D", "E"].map((sku) => ({ sku, quantity: 10, unitWeightG: 50 }));
    const r = computePackingPlan(items, config);
    expect(r.ok && r.plan.cartons.length).toBe(1);
  });

  it("fractionnement imposé par le poids (et non par la quantité)", () => {
    // 10 unités de 1 500 g = 15 000 g : la limite de 10 unités est respectée mais pas le poids.
    const r = computePackingPlan([{ sku: "LOURD", quantity: 10, unitWeightG: 1500 }], config);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.cartons.length).toBe(2); // 6 × 1 500 = 9 000 g ; 4 × 1 500 = 6 000 g
    expect(r.plan.cartons.map((c) => c.contents[0]!.quantity)).toEqual([6, 4]);
    assertValid(r.plan);
  });

  it("ne se contente pas de max(poids/10 kg, quantité/10) : vérification carton par carton", () => {
    // Poids total 9 × 3 000 = 27 000 g → ⌈27 000 / 9 500⌉ = 3, mais 3 unités de 3 000 g
    // ne tiennent pas dans 9 500 g (9 000 g oui) : 3 par carton → 3 cartons ; on vérifie la validité.
    const r = computePackingPlan([{ sku: "X", quantity: 10, unitWeightG: 3000 }], config);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // ⌈10 / 3⌉ = 4 cartons alors que ⌈30 000 / 9 500⌉ = 4 ; mêmes valeurs, mais chaque carton est contrôlé.
    expect(r.plan.cartons.length).toBe(4);
    assertValid(r.plan);
    const r2 = computePackingPlan([{ sku: "Y", quantity: 4, unitWeightG: 4800 }], config);
    // ⌈19 200 / 9 500⌉ = 3 selon la formule naïve, mais une seule unité de 4 800 g tient par carton (2 × 4 800 > 9 500) → 4.
    expect(r2.ok && r2.plan.cartons.length).toBe(4);
    if (r2.ok) {
      assertValid(r2.plan);
      expect(r2.plan.provedMinimal).toBe(false);
      expect(r2.plan.lowerBound).toBe(3);
    }
  });

  it("poids exactement à la limite accepté", () => {
    // 10 × 950 g = 9 500 g = capacité utile exacte ; 9 500 + 300 + 200 = 10 000 g.
    const r = computePackingPlan([{ sku: "A", quantity: 10, unitWeightG: 950 }], config);
    expect(r.ok && r.plan.cartons.length).toBe(1);
    if (r.ok) expect(r.plan.cartons[0]!.grossWeightG + 200).toBe(10_000);
    const over = computePackingPlan([{ sku: "A", quantity: 10, unitWeightG: 951 }], config);
    expect(over.ok && over.plan.cartons.length).toBe(2);
  });

  it("poids manquant : colisage refusé, jamais considéré comme zéro", () => {
    const r = computePackingPlan([{ sku: "A", quantity: 3, unitWeightG: null }], config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain("weight_missing");
    const zero = computePackingPlan([{ sku: "A", quantity: 3, unitWeightG: 0 }], config);
    expect(zero.ok).toBe(false);
  });

  it("tare ou marge non configurée : colisage refusé", () => {
    const r = computePackingPlan([{ sku: "A", quantity: 3, unitWeightG: 100 }], { ...config, cartonTareG: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain("carton_tare_missing");
    const m = computePackingPlan([{ sku: "A", quantity: 3, unitWeightG: 100 }], { ...config, safetyMarginG: null });
    expect(m.ok).toBe(false);
  });

  it("unité trop lourde pour un carton", () => {
    const r = computePackingPlan([{ sku: "A", quantity: 1, unitWeightG: 9501 }], config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.code).toBe("unit_too_heavy");
  });

  it("référence présente sur plusieurs lignes : quantités cumulées", () => {
    const r = computePackingPlan(
      [
        { sku: "A", quantity: 6, unitWeightG: 100 },
        { sku: "A", quantity: 6, unitWeightG: 100 },
      ],
      config,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(units(r.plan, "A")).toBe(12);
    expect(r.plan.cartons).toHaveLength(2);
    assertValid(r.plan);
  });

  it("résultat déterministe, indépendant de l'ordre des lignes", () => {
    const items = [
      { sku: "B", quantity: 17, unitWeightG: 420 },
      { sku: "A", quantity: 23, unitWeightG: 420 },
      { sku: "C", quantity: 9, unitWeightG: 1250 },
    ];
    const a = computePackingPlan(items, config);
    const b = computePackingPlan([...items].reverse(), config);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("propriétés sur des paniers variés : contraintes et quantités toujours respectées", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let n = 0; n < 300; n++) {
      const count = 1 + Math.floor(rand() * 6);
      const items = Array.from({ length: count }, (_, i) => ({
        sku: `S${i}`,
        quantity: 1 + Math.floor(rand() * 40),
        unitWeightG: 1 + Math.floor(rand() * 4000),
      }));
      const r = computePackingPlan(items, config);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      assertValid(r.plan);
      for (const it of items) expect(units(r.plan, it.sku)).toBe(it.quantity);
      expect(r.plan.cartons.length).toBeGreaterThanOrEqual(r.plan.lowerBound);
    }
  });
});

describe("ajustement manuel du colisage", () => {
  const items = [
    { sku: "A", quantity: 12, unitWeightG: 100 },
    { sku: "B", quantity: 3, unitWeightG: 500 },
  ];
  it("accepte une répartition valide", () => {
    const r = validateManualPlan(
      [{ contents: [{ sku: "A", quantity: 6 }, { sku: "B", quantity: 3 }] }, { contents: [{ sku: "A", quantity: 6 }] }],
      items,
      config,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.adjustedManually).toBe(true);
  });
  it("refuse une quantité différente de la commande", () => {
    const r = validateManualPlan([{ contents: [{ sku: "A", quantity: 10 }, { sku: "B", quantity: 3 }] }], items, config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain("quantity_mismatch");
  });
  it("refuse plus de 10 unités d'un SKU dans un carton", () => {
    const r = validateManualPlan([{ contents: [{ sku: "A", quantity: 12 }, { sku: "B", quantity: 3 }] }], items, config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain("carton_sku_limit");
  });
  it("refuse un carton trop lourd", () => {
    const heavy = [{ sku: "H", quantity: 4, unitWeightG: 3000 }];
    const r = validateManualPlan([{ contents: [{ sku: "H", quantity: 4 }] }], heavy, config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain("carton_overweight");
  });
  it("refuse un SKU étranger à la commande", () => {
    const r = validateManualPlan(
      [{ contents: [{ sku: "A", quantity: 12 }] }, { contents: [{ sku: "B", quantity: 3 }, { sku: "Z", quantity: 1 }] }],
      items,
      config,
    );
    expect(r.ok).toBe(false);
  });
});
