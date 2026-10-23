"use client";

import { useState } from "react";
import { formatMoney, toMajor } from "@/lib/domain/money";
import type { DayPoint } from "@/lib/server/dashboard";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const longDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Arrondit le maximum de l'axe à une valeur « ronde » juste au-dessus (1 ; 1,2 ; 1,5 ; 2 ; 2,5 ; 3 ; 4 ; 5 ; 6 ; 8 ; 10 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10;
  return step * p;
}

/** Chiffre d'affaires par jour (une seule série : pas de légende, le titre la nomme). */
export function RevenueChart({ days, currency }: { days: DayPoint[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const values = days.map((d) => toMajor(d.revenueMinor, currency));
  const max = niceMax(Math.max(...values));
  const ticks = [max, max / 2, 0];
  const hovered = active !== null ? days[active] : undefined;
  const mid = days[Math.floor(days.length / 2)];

  return (
    <div>
      <div className="relative flex gap-2">
        {/* Axe des valeurs */}
        <div className="flex h-44 w-10 shrink-0 flex-col justify-between text-right text-[11px] text-encre/50" aria-hidden="true">
          {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{compact.format(t)}</span>)}
        </div>
        <div className="relative h-44 flex-1">
          {/* Grille : traits fins, discrets */}
          {[0, 50, 100].map((pct) => <div key={pct} className="absolute inset-x-0 border-t border-sable/70" style={{ top: `${pct}%` }} aria-hidden="true" />)}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
            {days.map((d, i) => {
              const v = values[i] ?? 0;
              const h = v > 0 ? Math.max(2, (v / max) * 100) : 0;
              return (
                <button
                  key={d.day}
                  type="button"
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${longDate.format(new Date(d.day))} : ${formatMoney(d.revenueMinor, currency)}, ${d.orders} commande(s)`}
                >
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] transition-colors ${active === i ? "bg-marron" : "bg-symbole"} group-focus-visible:ring-2 group-focus-visible:ring-or`}
                    style={{ height: `${h}%` }}
                  />
                </button>
              );
            })}
          </div>
          {hovered && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-sable bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: `${Math.min(80, Math.max(20, ((active! + 0.5) / days.length) * 100))}%` }}
              role="status"
            >
              <p className="font-semibold capitalize text-encre">{longDate.format(new Date(hovered.day))}</p>
              <p className="text-encre/80">{formatMoney(hovered.revenueMinor, currency)} · {hovered.orders} commande{hovered.orders > 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      </div>
      <div className="ml-12 mt-1 flex justify-between text-[11px] text-encre/50" aria-hidden="true">
        <span>{days[0] ? shortDate.format(new Date(days[0].day)) : ""}</span>
        <span>{mid ? shortDate.format(new Date(mid.day)) : ""}</span>
        <span>Aujourd&apos;hui</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-encre/60">Voir les chiffres jour par jour</summary>
        <table className="table-admin mt-2">
          <thead><tr><th>Jour</th><th className="text-right">Chiffre d&apos;affaires</th><th className="text-right">Commandes</th></tr></thead>
          <tbody>
            {[...days].reverse().filter((d) => d.orders > 0).map((d) => (
              <tr key={d.day}><td className="capitalize">{longDate.format(new Date(d.day))}</td><td className="text-right">{formatMoney(d.revenueMinor, currency)}</td><td className="text-right">{d.orders}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
