"use client";

import Image from "next/image";
import Link from "next/link";
import { RETAIL_SCOPE, useCart } from "@/components/cart/cart-store";
import { IssuesList, QuoteSummary } from "@/components/checkout/QuoteSummary";
import { useQuote } from "@/components/checkout/useQuote";
import { formatMoney } from "@/lib/domain/money";

const RETAIL_MAX = 5;
const LATER_STEP = new Set(["destination_required", "method_required"]);

export function CartView() {
  const cart = useCart(RETAIL_SCOPE);
  const { quote, error, loading } = useQuote(
    "/api/panier/devis",
    cart.entries.length ? { lines: cart.entries.map((e) => ({ sku: e.sku, quantity: e.quantity })) } : null,
  );

  if (cart.entries.length === 0) {
    return (
      <div className="mt-8 rounded-lg bg-creme p-8 text-center">
        <p className="text-lg">Votre panier est vide.</p>
        <Link href="/boutique" className="btn-primary mt-4">Découvrir la boutique</Link>
      </div>
    );
  }

  const blocking = quote?.blockers.filter((b) => !LATER_STEP.has(b.code)) ?? [];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
      <ul className="divide-y divide-sable rounded-lg border border-sable bg-white">
        {cart.entries.map((e) => {
          const line = quote?.lines.find((l) => l.sku === e.sku);
          return (
            <li key={e.sku} className="flex gap-3 p-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-creme">
                {e.imageUrl && <Image src={e.imageUrl} alt="" width={80} height={80} className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Link href={`/produit/${e.slug}`} className="font-serif text-lg text-marron hover:underline">
                  {e.name}{e.label ? ` — ${e.label}` : ""}
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    Quantité
                    <select className="field w-20 min-h-10 py-1" value={e.quantity} onChange={(ev) => cart.setQuantity(e.sku, Number(ev.target.value))}>
                      {Array.from({ length: Math.max(RETAIL_MAX, e.quantity) }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="text-sm text-erreur underline" onClick={() => cart.remove(e.sku)}>Retirer</button>
                  <span className="ml-auto font-semibold">{line ? formatMoney(line.lineTotalMinor, line.currency) : loading ? "…" : "—"}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="space-y-4">
        {error && <p className="text-sm text-erreur" role="alert">{error}</p>}
        {quote && <IssuesList quote={quote} only={(c) => !LATER_STEP.has(c)} />}
        {quote && <QuoteSummary quote={quote} />}
        <Link
          href="/commande"
          aria-disabled={!quote || blocking.length > 0}
          className={`btn-primary w-full ${!quote || blocking.length > 0 ? "pointer-events-none opacity-50" : ""}`}
        >
          Passer la commande
        </Link>
        <p className="text-center text-sm text-encre/70">Sans création de compte. Maximum {RETAIL_MAX} pièces par référence.</p>
      </div>
    </div>
  );
}
