"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart/cart-store";
import { formatMoney } from "@/lib/domain/money";
import type { ResellerCatalogRow } from "@/lib/server/reseller";

interface ProductGroup {
  slug: string;
  name: string;
  imageUrl: string | null;
  rows: ResellerCatalogRow[];
}

/** Regroupe les références (contenances, senteurs) par produit, dans l'ordre du catalogue. */
function groupByProduct(rows: ResellerCatalogRow[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const r of rows) {
    const g = groups.get(r.productSlug) ?? { slug: r.productSlug, name: r.productName, imageUrl: r.imageUrl, rows: [] };
    g.rows.push(r);
    groups.set(r.productSlug, g);
  }
  return [...groups.values()];
}

function Stepper({ value, onChange, label, disabled }: { value: number; onChange: (n: number) => void; label: string; disabled?: boolean }) {
  const btn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-sable bg-white text-lg font-semibold text-marron hover:bg-creme disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled || value === 0} aria-label={`Retirer un — ${label}`}>−</button>
      <input
        aria-label={`Quantité — ${label}`}
        className="h-10 w-14 rounded-md border border-sable bg-white text-center font-semibold"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        onChange={(e) => onChange(Math.min(99999, Number.parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled} aria-label={`Ajouter un — ${label}`}>+</button>
    </div>
  );
}

/** Catalogue revendeur en cartes : quantités par référence, total calculé en direct, ajout au panier en une fois. */
export function QuickOrder({ rows, scope }: { rows: ResellerCatalogRow[]; scope: string }) {
  const cart = useCart(scope);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const groups = useMemo(() => groupByProduct(rows), [rows]);
  const visible = groups.filter((g) => `${g.name} ${g.rows.map((r) => `${r.variantLabel ?? ""} ${r.sku}`).join(" ")}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const currency = rows.find((r) => r.currency)?.currency ?? null;

  const selected = rows
    .filter((r) => (qty[r.sku] ?? 0) > 0 && r.unitPriceMinor !== null)
    .map((r) => ({ row: r, quantity: qty[r.sku] ?? 0 }));
  const totalUnits = selected.reduce((s, x) => s + x.quantity, 0);
  const totalMinor = selected.reduce((s, x) => s + (x.row.unitPriceMinor as number) * x.quantity, 0);

  function setQuantity(sku: string, n: number) {
    setMessage(null);
    setQty((q) => ({ ...q, [sku]: n }));
  }

  function addAll() {
    if (totalUnits === 0) return;
    for (const { row: r, quantity } of selected) {
      cart.add({ sku: r.sku, name: r.productName, label: r.variantLabel, slug: r.productSlug, imageUrl: r.imageUrl }, quantity);
    }
    setQty({});
    setMessage(`${totalUnits} article${totalUnits > 1 ? "s" : ""} ajouté${totalUnits > 1 ? "s" : ""} au panier.`);
  }

  if (rows.length === 0) return <p className="mt-6">Aucune référence disponible pour le moment.</p>;

  return (
    <div className="mt-6 pb-28">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="filtre" className="field-label">Rechercher un produit</label>
          <input id="filtre" className="field" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Savon, chantilly, Monoï…" />
        </div>
        <Link href="/revendeur/panier" className="btn-secondary">Voir le panier ({cart.count})</Link>
      </div>

      <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((g) => (
          <li key={g.slug} className="flex flex-col overflow-hidden rounded-2xl border border-sable bg-white">
            <div className="flex items-center gap-4 border-b border-sable/70 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-creme">
                {g.imageUrl ? (
                  <Image src={g.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <Image src="/brand/naaqati-calligraphie.webp" alt="" fill sizes="80px" unoptimized className="object-contain p-3 opacity-40" />
                )}
              </div>
              <h2 className="font-serif text-lg leading-snug text-marron">{g.name}</h2>
            </div>
            <ul className={`divide-y divide-sable/60 ${g.rows.length > 6 ? "max-h-96 overflow-y-auto" : ""}`}>
              {g.rows.map((r) => {
                const n = qty[r.sku] ?? 0;
                const label = r.variantLabel ?? r.netContent ?? "Format unique";
                return (
                  <li key={r.sku} className={`flex items-center justify-between gap-3 px-4 py-3 ${n > 0 ? "bg-creme/60" : ""}`}>
                    <div className="min-w-0">
                      <p className="font-semibold">{label}</p>
                      <p className="text-sm text-titre">
                        {r.unitPriceMinor !== null && r.currency ? formatMoney(r.unitPriceMinor, r.currency) : <span className="text-encre/60">Tarif à venir</span>}
                        {n > 0 && r.unitPriceMinor !== null && r.currency && <span className="text-encre/70"> · {formatMoney(r.unitPriceMinor * n, r.currency)}</span>}
                      </p>
                    </div>
                    <Stepper value={n} onChange={(v) => setQuantity(r.sku, v)} label={`${g.name} ${label}`} disabled={r.unitPriceMinor === null} />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="mt-6">Aucun produit ne correspond à « {filter} ».</p>}

      {/* Barre de total, toujours visible en bas de l'écran */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sable bg-papier/95 shadow-[0_-4px_16px_rgba(77,48,34,0.12)] backdrop-blur">
        <div className="container-page flex items-center justify-between gap-3 py-2 sm:py-3">
          <div role="status" aria-live="polite">
            {message ? (
              <p className="text-sm font-semibold text-succes sm:text-base">{message}</p>
            ) : (
              <>
                <p className="text-xs text-encre/70 sm:text-sm">{totalUnits} article{totalUnits > 1 ? "s" : ""}</p>
                <p className="text-lg font-semibold text-titre sm:text-xl">Total : {currency ? formatMoney(totalMinor, currency) : "—"}</p>
              </>
            )}
          </div>
          {totalUnits === 0 && cart.count > 0 ? (
            // Rien de nouveau à ajouter : on mène directement à la validation de la commande.
            <Link href="/revendeur/panier" className="btn-primary shrink-0 px-5 sm:px-8">Passer la commande ({cart.count}) →</Link>
          ) : (
            <button type="button" className="btn-primary shrink-0 px-5 sm:px-8" onClick={addAll} disabled={totalUnits === 0}>Ajouter au panier</button>
          )}
        </div>
      </div>
    </div>
  );
}
