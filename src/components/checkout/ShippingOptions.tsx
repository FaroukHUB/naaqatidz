"use client";

import type { Quote } from "@/lib/domain/quote";
import { formatMoney } from "@/lib/domain/money";

/** Modes de livraison réellement configurés pour la destination choisie. */
export function ShippingOptions({ quote, selected, onSelect }: { quote: Quote; selected: string | null; onSelect: (id: string) => void }) {
  const s = quote.shipping;
  if (s.status === "unavailable") {
    return <p className="rounded-md bg-rose/50 px-3 py-2 text-sm text-erreur">{s.issue.message}</p>;
  }
  if (s.status === "to_confirm") {
    return <p className="rounded-md bg-sable/60 px-3 py-2 text-sm">Les frais de livraison pour cette destination seront confirmés par Naaqati avant l&apos;expédition.</p>;
  }
  const options = quote.shippingOptions;
  if (options.length <= 1) return null;
  const current = s.status === "quoted" ? s.methodId : selected;
  return (
    <fieldset>
      <legend className="field-label">Mode de livraison *</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o.methodId} className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 ${current === o.methodId ? "border-symbole bg-creme" : "border-sable bg-white"} ${o.available ? "cursor-pointer" : "opacity-60"}`}>
            <span className="flex items-center gap-2">
              <input type="radio" name="livraison" value={o.methodId} disabled={!o.available} checked={current === o.methodId} onChange={() => onSelect(o.methodId)} />
              <span>
                {o.label}
                {o.description && <span className="block text-xs text-encre/70">{o.description}</span>}
              </span>
            </span>
            <span className="text-sm font-semibold">{o.available ? formatMoney(o.amountMinor, "DZD") : "Indisponible"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
