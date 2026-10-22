"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { RESELLER_SCOPE } from "./scopes";

/**
 * Panier stocké dans le navigateur : uniquement des SKU, des quantités et des libellés d'affichage.
 * Aucun prix n'y est conservé : les montants sont toujours recalculés par le serveur.
 */
export interface CartEntry {
  sku: string;
  quantity: number;
  name: string;
  label: string | null;
  slug: string;
  imageUrl: string | null;
}

const EVENT = "naaqati-cart-change";
const cache = new Map<string, { raw: string | null; entries: CartEntry[] }>();
const EMPTY: CartEntry[] = [];

function storageKey(scope: string) {
  return `naaqati:panier:${scope}:v1`;
}

function read(scope: string): CartEntry[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey(scope));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(scope);
  if (hit && hit.raw === raw) return hit.entries;
  let entries: CartEntry[] = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      entries = parsed.filter(
        (e): e is CartEntry => !!e && typeof e.sku === "string" && Number.isInteger(e.quantity) && e.quantity > 0 && typeof e.name === "string",
      );
    }
  } catch {
    entries = EMPTY;
  }
  cache.set(scope, { raw, entries });
  return entries;
}

function write(scope: string, entries: CartEntry[]) {
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(entries));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le panier reste en mémoire pour cette page.
    cache.set(scope, { raw: JSON.stringify(entries), entries });
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCart(scope: string) {
  const entries = useSyncExternalStore(subscribe, () => read(scope), () => EMPTY);

  const setEntries = useCallback((fn: (prev: CartEntry[]) => CartEntry[]) => write(scope, fn(read(scope))), [scope]);

  return useMemo(
    () => ({
      entries,
      count: entries.reduce((s, e) => s + e.quantity, 0),
      add(entry: Omit<CartEntry, "quantity">, quantity: number, max?: number) {
        setEntries((prev) => {
          const existing = prev.find((e) => e.sku === entry.sku);
          const next = Math.min((existing?.quantity ?? 0) + quantity, max ?? Number.MAX_SAFE_INTEGER);
          return existing ? prev.map((e) => (e.sku === entry.sku ? { ...e, ...entry, quantity: next } : e)) : [...prev, { ...entry, quantity: next }];
        });
      },
      setQuantity(sku: string, quantity: number) {
        setEntries((prev) => (quantity <= 0 ? prev.filter((e) => e.sku !== sku) : prev.map((e) => (e.sku === sku ? { ...e, quantity } : e))));
      },
      remove(sku: string) {
        setEntries((prev) => prev.filter((e) => e.sku !== sku));
      },
      clear() {
        setEntries(() => []);
      },
    }),
    [entries, setEntries],
  );
}

export { RETAIL_SCOPE, RESELLER_SCOPE } from "./scopes";

const RESELLER_OWNER_KEY = "naaqati:panier:revendeur:compte";

/** Vide le panier revendeur si un autre compte revendeur s'est connecté sur ce navigateur. */
export function claimResellerCart(userId: string) {
  try {
    if (window.localStorage.getItem(RESELLER_OWNER_KEY) !== userId) {
      window.localStorage.setItem(RESELLER_OWNER_KEY, userId);
      write(RESELLER_SCOPE, []);
    }
  } catch {
    // Stockage indisponible : le panier reste propre à l'onglet.
  }
}
