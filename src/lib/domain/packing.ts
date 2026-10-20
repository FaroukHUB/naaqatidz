import type { Issue, PackingConfig } from "./types";

/**
 * Colisage des commandes revendeurs Algérie.
 *
 * Contraintes (règles transmises par la cliente, à ne pas confondre avec des conditions transporteur) :
 *  - au maximum `maxUnitsPerSkuPerCarton` unités de chaque SKU par carton ;
 *  - poids des produits + tare du carton + marge de protection <= `maxCartonWeightG`.
 *
 * Les dimensions et la fragilité ne sont pas connues : le plan est calculé uniquement
 * selon les contraintes de quantité et de poids, il ne garantit pas que les produits
 * tiennent physiquement dans le volume d'un carton.
 *
 * Algorithme (heuristique déterministe « first-fit decreasing » par référence, version ffd-v1) :
 *  1. Capacité utile C = poids max − tare − marge (en grammes entiers).
 *  2. Les références sont triées par poids unitaire décroissant, puis par SKU (ordre stable).
 *  3. Pour chaque référence, on remplit d'abord les cartons déjà ouverts, dans l'ordre,
 *     avec autant d'unités que possible (limite par SKU et poids restant), puis on ouvre
 *     de nouveaux cartons.
 *  4. Chaque carton produit est revérifié contrainte par contrainte.
 * Une borne inférieure (max(⌈poids total / C⌉, ⌈quantité d'un SKU / limite⌉)) est calculée :
 * si le plan l'atteint, son nombre de cartons est prouvé minimal ; sinon il ne l'est pas forcément.
 */

export const PACKING_ALGORITHM = "ffd-v1";

export interface PackingItem {
  sku: string;
  quantity: number;
  unitWeightG: number | null;
  label?: string;
}

export interface CartonContent {
  sku: string;
  quantity: number;
  unitWeightG: number;
  weightG: number;
}

export interface Carton {
  index: number;
  contents: CartonContent[];
  itemsWeightG: number;
  tareG: number;
  /** Poids calculé : produits + tare (la marge de protection n'est pas un poids physique). */
  grossWeightG: number;
}

export interface PackingPlan {
  algorithm: string;
  config: PackingConfig;
  capacityG: number;
  cartons: Carton[];
  totalItemsWeightG: number;
  totalGrossWeightG: number;
  lowerBound: number;
  provedMinimal: boolean;
  adjustedManually: boolean;
}

export type PackingResult = { ok: true; plan: PackingPlan } | { ok: false; issues: Issue[] };

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function isNonNegativeInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** Vérifie la configuration et les poids ; ne remplace jamais une valeur manquante par zéro. */
function preflight(items: readonly PackingItem[], config: PackingConfig): { issues: Issue[]; capacityG: number } {
  const issues: Issue[] = [];
  if (!isPositiveInt(config.maxUnitsPerSkuPerCarton)) {
    issues.push({ code: "packing_config_invalid", message: "Limite d'unités par carton non configurée." });
  }
  if (!isPositiveInt(config.maxCartonWeightG)) {
    issues.push({ code: "packing_config_invalid", message: "Poids maximum par carton non configuré." });
  }
  if (!isNonNegativeInt(config.cartonTareG)) {
    issues.push({ code: "carton_tare_missing", message: "La tare du carton n'est pas configurée." });
  }
  if (!isNonNegativeInt(config.safetyMarginG)) {
    issues.push({ code: "safety_margin_missing", message: "La marge de protection du carton n'est pas configurée." });
  }
  const capacityG =
    issues.length === 0 ? config.maxCartonWeightG - (config.cartonTareG ?? 0) - (config.safetyMarginG ?? 0) : 0;
  if (issues.length === 0 && capacityG <= 0) {
    issues.push({ code: "packing_config_invalid", message: "La tare et la marge dépassent le poids maximum du carton." });
  }
  for (const item of items) {
    const name = item.label ?? item.sku;
    if (!isPositiveInt(item.unitWeightG)) {
      issues.push({ code: "weight_missing", message: `Poids d'expédition manquant pour « ${name} ».`, sku: item.sku });
    } else if (capacityG > 0 && item.unitWeightG > capacityG) {
      issues.push({
        code: "unit_too_heavy",
        message: `Une unité de « ${name} » (${item.unitWeightG} g) dépasse la capacité utile d'un carton (${capacityG} g).`,
        sku: item.sku,
      });
    }
    if (!isPositiveInt(item.quantity)) {
      issues.push({ code: "invalid_quantity", message: `Quantité invalide pour « ${name} ».`, sku: item.sku });
    }
  }
  return { issues, capacityG };
}

function mergeItems(items: readonly PackingItem[]): PackingItem[] {
  const merged = new Map<string, PackingItem>();
  for (const item of items) {
    const prev = merged.get(item.sku);
    if (prev) prev.quantity += item.quantity;
    else merged.set(item.sku, { ...item });
  }
  return [...merged.values()];
}

export function lowerBound(items: readonly PackingItem[], config: PackingConfig, capacityG: number): number {
  let bound = 0;
  let total = 0;
  for (const item of items) {
    bound = Math.max(bound, Math.ceil(item.quantity / config.maxUnitsPerSkuPerCarton));
    total += item.quantity * (item.unitWeightG ?? 0);
  }
  return Math.max(bound, Math.ceil(total / capacityG));
}

export function computePackingPlan(rawItems: readonly PackingItem[], config: PackingConfig): PackingResult {
  const items = mergeItems(rawItems);
  if (items.length === 0) return { ok: false, issues: [{ code: "empty_cart", message: "Aucun article à mettre en carton." }] };
  const { issues, capacityG } = preflight(items, config);
  if (issues.length > 0) return { ok: false, issues };

  const sorted = [...items].sort(
    (a, b) => (b.unitWeightG as number) - (a.unitWeightG as number) || (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0),
  );
  const maxUnits = config.maxUnitsPerSkuPerCarton;
  const open: { contents: Map<string, number>; weight: number }[] = [];

  for (const item of sorted) {
    const w = item.unitWeightG as number;
    let remaining = item.quantity;
    for (const carton of open) {
      if (remaining === 0) break;
      const already = carton.contents.get(item.sku) ?? 0;
      const fit = Math.min(remaining, maxUnits - already, Math.floor((capacityG - carton.weight) / w));
      if (fit > 0) {
        carton.contents.set(item.sku, already + fit);
        carton.weight += fit * w;
        remaining -= fit;
      }
    }
    while (remaining > 0) {
      const fit = Math.min(remaining, maxUnits, Math.floor(capacityG / w));
      open.push({ contents: new Map([[item.sku, fit]]), weight: fit * w });
      remaining -= fit;
    }
  }

  const weights = new Map(items.map((i) => [i.sku, i.unitWeightG as number]));
  const cartons = open.map((c, i) => buildCarton(i + 1, c.contents, weights, config.cartonTareG as number));
  const plan = finalizePlan(cartons, items, config, capacityG, false);
  const check = checkCartons(plan.cartons, config, capacityG);
  if (check.length > 0) return { ok: false, issues: check }; // garde-fou : ne devrait jamais arriver
  return { ok: true, plan };
}

function buildCarton(index: number, contents: Map<string, number>, weights: Map<string, number>, tareG: number): Carton {
  const list: CartonContent[] = [...contents].map(([sku, quantity]) => {
    const unitWeightG = weights.get(sku) as number;
    return { sku, quantity, unitWeightG, weightG: unitWeightG * quantity };
  });
  const itemsWeightG = list.reduce((s, c) => s + c.weightG, 0);
  return { index, contents: list, itemsWeightG, tareG, grossWeightG: itemsWeightG + tareG };
}

function finalizePlan(
  cartons: Carton[],
  items: PackingItem[],
  config: PackingConfig,
  capacityG: number,
  adjustedManually: boolean,
): PackingPlan {
  const bound = lowerBound(items, config, capacityG);
  return {
    algorithm: adjustedManually ? `${PACKING_ALGORITHM}+ajustement` : PACKING_ALGORITHM,
    config: { ...config },
    capacityG,
    cartons,
    totalItemsWeightG: cartons.reduce((s, c) => s + c.itemsWeightG, 0),
    totalGrossWeightG: cartons.reduce((s, c) => s + c.grossWeightG, 0),
    lowerBound: bound,
    provedMinimal: cartons.length === bound,
    adjustedManually,
  };
}

/** Vérifie chaque carton individuellement. */
function checkCartons(cartons: readonly Carton[], config: PackingConfig, capacityG: number): Issue[] {
  const issues: Issue[] = [];
  for (const carton of cartons) {
    if (carton.contents.length === 0) {
      issues.push({ code: "empty_carton", message: `Le carton ${carton.index} est vide.` });
    }
    for (const c of carton.contents) {
      if (c.quantity > config.maxUnitsPerSkuPerCarton) {
        issues.push({
          code: "carton_sku_limit",
          message: `Carton ${carton.index} : ${c.quantity} unités de ${c.sku} (maximum ${config.maxUnitsPerSkuPerCarton}).`,
          sku: c.sku,
        });
      }
    }
    if (carton.itemsWeightG > capacityG) {
      issues.push({
        code: "carton_overweight",
        message: `Carton ${carton.index} : ${carton.itemsWeightG} g de produits pour une capacité utile de ${capacityG} g.`,
      });
    }
  }
  return issues;
}

export interface ManualCartonInput {
  contents: { sku: string; quantity: number }[];
}

/**
 * Valide une répartition ajustée par l'administratrice : mêmes quantités que la commande,
 * aucun SKU inconnu, et contraintes respectées carton par carton.
 */
export function validateManualPlan(
  cartonsInput: readonly ManualCartonInput[],
  orderItems: readonly PackingItem[],
  config: PackingConfig,
): PackingResult {
  const items = mergeItems(orderItems);
  const { issues, capacityG } = preflight(items, config);
  if (issues.length > 0) return { ok: false, issues };

  const weights = new Map(items.map((i) => [i.sku, i.unitWeightG as number]));
  const placed = new Map<string, number>();
  const cartons: Carton[] = [];
  const errors: Issue[] = [];

  cartonsInput.forEach((input, i) => {
    const contents = new Map<string, number>();
    for (const c of input.contents) {
      if (c.quantity === 0) continue;
      if (!weights.has(c.sku)) {
        errors.push({ code: "unknown_sku", message: `Carton ${i + 1} : la référence ${c.sku} ne fait pas partie de la commande.`, sku: c.sku });
        continue;
      }
      if (!isPositiveInt(c.quantity)) {
        errors.push({ code: "invalid_quantity", message: `Carton ${i + 1} : quantité invalide pour ${c.sku}.`, sku: c.sku });
        continue;
      }
      contents.set(c.sku, (contents.get(c.sku) ?? 0) + c.quantity);
      placed.set(c.sku, (placed.get(c.sku) ?? 0) + c.quantity);
    }
    if (contents.size > 0) cartons.push(buildCarton(cartons.length + 1, contents, weights, config.cartonTareG as number));
  });

  for (const item of items) {
    const got = placed.get(item.sku) ?? 0;
    if (got !== item.quantity) {
      errors.push({
        code: "quantity_mismatch",
        message: `${item.label ?? item.sku} : ${got} unités réparties pour ${item.quantity} commandées.`,
        sku: item.sku,
      });
    }
  }
  if (cartons.length === 0) errors.push({ code: "empty_plan", message: "Aucun carton." });
  errors.push(...checkCartons(cartons, config, capacityG));
  if (errors.length > 0) return { ok: false, issues: errors };
  return { ok: true, plan: finalizePlan(cartons, items, config, capacityG, true) };
}
