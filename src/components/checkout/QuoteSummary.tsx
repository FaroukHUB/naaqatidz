"use client";

import type { Quote } from "@/lib/domain/quote";
import { formatMoney } from "@/lib/domain/money";

export function shippingText(quote: Quote): string {
  const s = quote.shipping;
  switch (s.status) {
    case "quoted":
    case "fr_fixed":
      return formatMoney(s.amountMinor, quote.currency ?? "DZD");
    case "pending_destination":
      return "Calculée après le choix de la commune";
    case "choose_method":
      return "Choisissez un mode de livraison";
    case "to_confirm":
      return "À confirmer par Naaqati";
    case "fr_on_quote":
      return "Communiqués par Naaqati après la commande";
    case "fr_not_configured":
      return "Conditions à confirmer";
    case "unavailable":
      return "Indisponible";
  }
}

export function QuoteSummary({ quote, title = "Récapitulatif", showPayment = true }: { quote: Quote; title?: string; showPayment?: boolean }) {
  const currency = quote.currency;
  return (
    <section aria-labelledby="recap" className="card p-4">
      <h2 id="recap" className="text-2xl">{title}</h2>
      {quote.lines.length > 0 && (
        <ul className="mt-3 divide-y divide-sable">
          {quote.lines.map((l) => (
            <li key={l.sku} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {l.productName}
                {l.variantLabel ? ` — ${l.variantLabel}` : ""} <span className="text-encre/70">× {l.quantity}</span>
              </span>
              <span className="shrink-0 font-semibold">{formatMoney(l.lineTotalMinor, l.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      {currency && (
        <dl className="mt-3 space-y-1 border-t border-sable pt-3 text-sm">
          <div className="flex justify-between"><dt>Sous-total</dt><dd>{formatMoney(quote.subtotalMinor, currency)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Livraison</dt><dd className="text-right">{shippingText(quote)}</dd></div>
          <div className="flex justify-between border-t border-sable pt-2 text-base font-semibold">
            <dt>{quote.totalIsFinal ? "Total" : "Total hors livraison"}</dt>
            <dd>{formatMoney(quote.totalMinor, currency)}</dd>
          </div>
          <p className="text-xs text-encre/70">Montants en {currency}{quote.totalIsFinal ? "" : " — le total définitif sera confirmé par Naaqati"}.</p>
        </dl>
      )}
      {showPayment && quote.channel !== "reseller_fr" && (
        <p className="mt-3 rounded-md bg-creme px-3 py-2 text-sm font-semibold text-marron">Paiement à la livraison.</p>
      )}
    </section>
  );
}

export function IssuesList({ quote, only }: { quote: Quote; only?: (code: string) => boolean }) {
  const issues = quote.blockers.filter((b) => (only ? only(b.code) : true));
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-md border border-erreur/40 bg-rose/50 px-4 py-3 text-sm text-erreur" role="alert">
      {issues.map((b, i) => (
        <li key={i}>{b.message}</li>
      ))}
    </ul>
  );
}

export function PackingPlanView({ quote }: { quote: Quote }) {
  if (!quote.packing) return null;
  const p = quote.packing;
  return (
    <section className="card p-4" aria-labelledby="colisage">
      <h2 id="colisage" className="text-xl">Colisage calculé : {p.cartons.length} carton{p.cartons.length > 1 ? "s" : ""}</h2>
      <p className="mt-1 text-xs text-encre/70">
        Calculé selon les contraintes de quantité (max. {p.config.maxUnitsPerSkuPerCarton} unités par référence et par carton) et de poids
        (max. {p.config.maxCartonWeightG / 1000} kg, tare et marge comprises). Les dimensions des produits ne sont pas prises en compte.
      </p>
      <ol className="mt-3 space-y-2 text-sm">
        {p.cartons.map((c) => (
          <li key={c.index} className="rounded-md bg-creme px-3 py-2">
            <p className="font-semibold">Carton {c.index} — {(c.grossWeightG / 1000).toLocaleString("fr-FR")} kg</p>
            <ul className="mt-1">
              {c.contents.map((x) => {
                const line = quote.lines.find((l) => l.sku === x.sku);
                return <li key={x.sku}>{x.quantity} × {line ? `${line.productName}${line.variantLabel ? ` — ${line.variantLabel}` : ""}` : x.sku}</li>;
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
