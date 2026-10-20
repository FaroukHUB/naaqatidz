import type { CartItem, CartLineInput, Issue } from "./types";

export const MAX_CART_LINES = 300;
export const MAX_QUANTITY_PER_LINE = 100_000;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function isValidSku(sku: string): boolean {
  return SKU_PATTERN.test(sku);
}

/**
 * Regroupe les lignes par SKU (quantités cumulées), dans l'ordre de première apparition.
 * Les limites par référence portent sur ces quantités cumulées, même si le panier
 * contient plusieurs lignes identiques.
 */
export function aggregateLines(lines: readonly CartLineInput[]): { items: CartItem[]; issues: Issue[] } {
  const issues: Issue[] = [];
  if (lines.length > MAX_CART_LINES) {
    return { items: [], issues: [{ code: "too_many_lines", message: "Le panier contient trop de lignes." }] };
  }
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!isValidSku(line.sku)) {
      issues.push({ code: "invalid_sku", message: "Référence invalide.", sku: line.sku });
      continue;
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY_PER_LINE) {
      issues.push({ code: "invalid_quantity", message: "Quantité invalide.", sku: line.sku });
      continue;
    }
    totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.quantity);
  }
  const items = [...totals].map(([sku, quantity]) => ({ sku, quantity }));
  if (items.length === 0 && issues.length === 0) {
    issues.push({ code: "empty_cart", message: "Le panier est vide." });
  }
  return { items, issues };
}
