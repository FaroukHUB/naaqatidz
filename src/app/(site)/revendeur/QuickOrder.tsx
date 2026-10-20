"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-store";
import { formatMoney } from "@/lib/domain/money";
import type { ResellerCatalogRow } from "@/lib/server/reseller";

/** Saisie rapide des quantités pour plusieurs références à la fois. */
export function QuickOrder({ rows, scope }: { rows: ResellerCatalogRow[]; scope: string }) {
  const cart = useCart(scope);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const visible = rows.filter((r) => `${r.productName} ${r.variantLabel ?? ""} ${r.sku}`.toLowerCase().includes(filter.toLowerCase()));

  function addAll() {
    let added = 0;
    for (const r of rows) {
      const n = Number.parseInt(qty[r.sku] ?? "", 10);
      if (Number.isInteger(n) && n > 0 && r.unitPriceMinor !== null) {
        cart.add({ sku: r.sku, name: r.productName, label: r.variantLabel, slug: r.productSlug, imageUrl: r.imageUrl }, n);
        added += n;
      }
    }
    setQty({});
    setMessage(added > 0 ? `${added} article${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} au panier.` : "Saisissez au moins une quantité.");
  }

  if (rows.length === 0) return <p className="mt-6">Aucune référence disponible pour le moment.</p>;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label htmlFor="filtre" className="field-label">Rechercher</label>
          <input id="filtre" className="field" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nom ou SKU" />
        </div>
        <Link href="/revendeur/panier" className="btn-secondary">Panier ({cart.count})</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-sable bg-white">
        <table className="table-admin">
          <thead>
            <tr><th>Produit</th><th>SKU</th><th className="text-right">Prix unitaire</th><th className="w-28">Quantité</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.sku}>
                <td>{r.productName}{r.variantLabel ? ` — ${r.variantLabel}` : ""}</td>
                <td className="font-mono text-xs">{r.sku}</td>
                <td className="text-right">{r.unitPriceMinor !== null && r.currency ? formatMoney(r.unitPriceMinor, r.currency) : <span className="text-encre/60">Tarif non configuré</span>}</td>
                <td>
                  <input
                    aria-label={`Quantité pour ${r.productName}${r.variantLabel ? ` ${r.variantLabel}` : ""}`}
                    className="field min-h-10 py-1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={r.unitPriceMinor === null}
                    value={qty[r.sku] ?? ""}
                    onChange={(e) => setQty((q) => ({ ...q, [r.sku]: e.target.value.replace(/\D/g, "") }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={addAll}>Ajouter au panier</button>
        {message && <p role="status" className="text-sm font-semibold text-succes">{message}</p>}
      </div>
    </div>
  );
}
