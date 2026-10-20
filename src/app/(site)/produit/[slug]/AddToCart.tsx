"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { SkuView } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/domain/money";
import { RETAIL_SCOPE, useCart } from "@/components/cart/cart-store";

/** Limite affichée pour les particuliers ; la règle est revérifiée par le serveur à la commande. */
const RETAIL_MAX = 5;

export function AddToCart({ product, skus }: { product: { title: string; slug: string; imageUrl: string | null }; skus: SkuView[] }) {
  const cart = useCart(RETAIL_SCOPE);
  const firstSaleable = skus.find((s) => s.saleable) ?? null;
  const [selected, setSelected] = useState<string | null>(firstSaleable?.sku ?? null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const qtyId = useId();

  const current = skus.find((s) => s.sku === selected) ?? null;
  const inCart = cart.entries.find((e) => e.sku === selected)?.quantity ?? 0;
  const remaining = Math.max(0, RETAIL_MAX - inCart);

  if (!firstSaleable) {
    return <p className="rounded-md bg-creme p-4">Ce produit n&apos;est pas disponible à la vente en ligne pour le moment.</p>;
  }

  function add() {
    if (!current || !current.saleable) return;
    const qty = Math.min(quantity, remaining);
    if (qty <= 0) {
      setMessage(`Vous avez déjà ${RETAIL_MAX} pièces de cette référence dans votre panier (maximum par référence).`);
      return;
    }
    cart.add({ sku: current.sku, name: product.title, label: current.label, slug: product.slug, imageUrl: product.imageUrl }, qty, RETAIL_MAX);
    setMessage(`${qty} × ajouté${qty > 1 ? "s" : ""} au panier.`);
    setQuantity(1);
  }

  return (
    <div className="space-y-4">
      {skus.length > 1 && (
        <fieldset>
          <legend className="field-label">Choisissez une variante</legend>
          <div className="grid gap-2">
            {skus.map((s) => (
              <label key={s.sku} className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 ${selected === s.sku ? "border-symbole bg-creme" : "border-sable bg-white"} ${s.saleable ? "" : "cursor-not-allowed opacity-60"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="variante" value={s.sku} checked={selected === s.sku} disabled={!s.saleable} onChange={() => { setSelected(s.sku); setMessage(null); }} />
                  <span>{s.label}{s.netContent ? ` — ${s.netContent}` : ""}</span>
                </span>
                <span className="font-semibold text-titre">{s.saleable && s.priceDzdMinor !== null ? formatMoney(s.priceDzdMinor, "DZD") : "Indisponible"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {current && current.priceDzdMinor !== null && (
        <p className="text-2xl font-semibold text-titre">
          {formatMoney(current.priceDzdMinor, "DZD")}
          {skus.length === 1 && current.netContent && <span className="ml-2 text-base font-normal text-encre/70">{current.netContent}</span>}
        </p>
      )}
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor={qtyId} className="field-label">Quantité</label>
          <select id={qtyId} className="field w-24" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} disabled={remaining === 0}>
            {Array.from({ length: Math.max(1, remaining) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-primary flex-1" onClick={add} disabled={!current?.saleable || remaining === 0}>
          Ajouter au panier
        </button>
      </div>
      <p className="text-sm text-encre/70">Maximum {RETAIL_MAX} pièces par référence. Paiement à la livraison en Algérie.</p>
      {message && (
        <p role="status" className="text-sm font-semibold text-succes">
          {message} <Link href="/panier" className="underline">Voir le panier</Link>
        </p>
      )}
    </div>
  );
}
