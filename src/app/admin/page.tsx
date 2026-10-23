import Link from "next/link";
import { content } from "@/lib/catalog";
import { isSanityConfigured } from "@/lib/env";
import { franceMissingTerms } from "@/lib/domain/quote";
import { mapSettings, type SettingsRow } from "@/lib/server/commerce-store";
import { createSessionClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/domain/money";
import { CHANNEL_LABELS, STATUS_LABELS } from "@/lib/order-labels";
import { getDashboardStats } from "@/lib/server/dashboard";
import { RevenueChart } from "./RevenueChart";

export default async function AdminHome() {
  const supabase = await createSessionClient();
  const [{ count: newOrders }, { count: pending }, { data: settingsRow }, { count: rates }, { count: wilayas }, { data: frPrices }, skus] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "reseller").eq("status", "pending"),
    supabase.from("commerce_settings").select("*").eq("id", 1).single(),
    supabase.from("shipping_rates").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("shipping_wilaya_settings").select("wilaya_code", { count: "exact", head: true }).eq("enabled", true),
    supabase.from("reseller_prices").select("sku"),
    content.listAllSkus().catch(() => []),
  ]);
  const settings = settingsRow ? mapSettings(settingsRow as SettingsRow) : null;
  const saleable = skus.filter((s) => s.saleable);
  const noWeight = saleable.filter((s) => s.shippingWeightG === null);
  const frSet = new Set((frPrices ?? []).map((p) => p.sku));
  const noFr = saleable.filter((s) => !frSet.has(s.sku));

  const checks: { ok: boolean; text: string; href: string }[] = [
    { ok: isSanityConfigured, text: "Catalogue Sanity connecté", href: "/studio" },
    { ok: saleable.length > 0, text: `${saleable.length} référence(s) en vente`, href: "/studio" },
    { ok: noWeight.length === 0, text: noWeight.length ? `${noWeight.length} référence(s) en vente sans poids d'expédition` : "Poids d'expédition renseignés", href: "/studio" },
    { ok: settings?.packing.cartonTareG !== null && settings?.packing.safetyMarginG !== null, text: "Tare du carton et marge de protection", href: "/admin/parametres" },
    { ok: (wilayas ?? 0) > 0, text: `${wilayas ?? 0} wilaya(s) desservie(s)`, href: "/admin/livraison" },
    { ok: (rates ?? 0) > 0, text: `${rates ?? 0} tarif(s) de livraison actif(s)`, href: "/admin/livraison" },
    { ok: settings ? franceMissingTerms(settings).length === 0 : false, text: "Conditions revendeurs France (devise, paiement, expédition)", href: "/admin/parametres" },
    { ok: noFr.length === 0, text: noFr.length ? `${noFr.length} référence(s) sans tarif France` : "Tarifs France renseignés", href: "/admin/tarifs-france" },
  ];

  const stats = await getDashboardStats(supabase);
  const avgBasket = (p: { revenueMinor: number; orders: number }) => (p.orders ? Math.round(p.revenueMinor / p.orders) : 0);

  // Priorités : uniquement ce qui demande une action, du plus urgent au moins urgent.
  const todo: { level: "urgent" | "attention" | "info"; count: number | null; text: string; action: string; href: string }[] = [];
  if ((newOrders ?? 0) > 0) todo.push({ level: "urgent", count: newOrders ?? 0, text: `nouvelle${(newOrders ?? 0) > 1 ? "s" : ""} commande${(newOrders ?? 0) > 1 ? "s" : ""} à traiter`, action: "Traiter", href: "/admin/commandes?statut=nouvelle" });
  if (stats.toConfirmShipping > 0) todo.push({ level: "attention", count: stats.toConfirmShipping, text: `commande${stats.toConfirmShipping > 1 ? "s" : ""} avec frais de livraison à confirmer au client`, action: "Voir", href: "/admin/commandes" });
  if ((pending ?? 0) > 0) todo.push({ level: "attention", count: pending ?? 0, text: `revendeur${(pending ?? 0) > 1 ? "s" : ""} France à activer`, action: "Activer", href: "/admin/revendeurs" });
  if (noWeight.length > 0) todo.push({ level: "attention", count: noWeight.length, text: `produit${noWeight.length > 1 ? "s" : ""} sans poids d'expédition (cartons revendeurs bloqués)`, action: "Studio", href: "/studio" });
  if ((rates ?? 0) === 0) todo.push({ level: "info", count: null, text: "Aucun tarif de livraison : les frais sont « à confirmer » sur chaque commande", action: "Saisir les tarifs", href: "/admin/livraison" });

  const LEVEL = {
    urgent: { dot: "bg-erreur", badge: "bg-rose/70 text-erreur", label: "Urgent" },
    attention: { dot: "bg-or", badge: "bg-sable/70 text-marron", label: "À faire" },
    info: { dot: "bg-kraft", badge: "bg-creme text-encre/70", label: "Conseil" },
  } as const;
  const channelTotal = stats.byChannel.reduce((s, c) => s + c.revenueMinor, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-encre/60">{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Algiers" }).format(new Date())}</p>
          <h1 className="text-3xl">Tableau de bord</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/commandes" className="btn-primary btn-small">Commandes</Link>
          <Link href="/admin/revendeurs" className="btn-secondary btn-small">Ajouter un revendeur</Link>
          <Link href="/studio" prefetch={false} className="btn-secondary btn-small">Catalogue (Studio) ↗</Link>
        </div>
      </div>

      {/* À faire maintenant */}
      <section aria-labelledby="todo" className="rounded-2xl border border-sable bg-white p-5 shadow-sm">
        <h2 id="todo" className="text-xl">À faire maintenant</h2>
        {todo.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-succes"><span aria-hidden="true">✓</span> Tout est à jour.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sable/60">
            {todo.map((t) => (
              <li key={t.text} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${LEVEL[t.level].badge}`}>
                    <span aria-hidden="true" className={`mr-1 inline-block h-2 w-2 rounded-full ${LEVEL[t.level].dot}`} />{LEVEL[t.level].label}
                  </span>
                  <p>{t.count !== null && <strong className="text-lg">{t.count} </strong>}{t.text}</p>
                </div>
                <Link href={t.href} prefetch={false} className="btn-secondary btn-small">{t.action} →</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Indicateurs clés (Algérie, en DZD) */}
      <section aria-labelledby="kpi">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kpi" className="text-xl">Ventes des 30 derniers jours</h2>
          <p className="text-sm text-encre/60">Aujourd&apos;hui : <strong className="text-encre">{stats.today.orders} commande{stats.today.orders > 1 ? "s" : ""}</strong> · {formatMoney(stats.today.revenueMinor, "DZD")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi label="Chiffre d'affaires" value={formatMoney(stats.current.revenueMinor, "DZD")} current={stats.current.revenueMinor} previous={stats.previous.revenueMinor} hero />
          <Kpi label="Commandes" value={String(stats.current.orders)} current={stats.current.orders} previous={stats.previous.orders} />
          <Kpi label="Panier moyen" value={formatMoney(avgBasket(stats.current), "DZD")} current={avgBasket(stats.current)} previous={avgBasket(stats.previous)} />
          <Kpi label="Articles vendus" value={String(stats.current.units)} current={stats.current.units} previous={stats.previous.units} />
        </div>
        <p className="mt-2 text-xs text-encre/50">Chiffre d&apos;affaires des produits, hors frais de livraison ; commandes annulées et retournées exclues. Comparaison avec les 30 jours précédents.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="ca-jour" className="rounded-2xl border border-sable bg-white p-5 shadow-sm lg:col-span-2">
          <h2 id="ca-jour" className="mb-4 text-xl">Chiffre d&apos;affaires par jour (DZD)</h2>
          <RevenueChart days={stats.days} currency="DZD" />
        </section>
        <section aria-labelledby="canaux" className="rounded-2xl border border-sable bg-white p-5 shadow-sm">
          <h2 id="canaux" className="text-xl">Qui achète ?</h2>
          <ul className="mt-4 space-y-4">
            {stats.byChannel.map((c) => {
              const pct = channelTotal ? Math.round((c.revenueMinor / channelTotal) * 100) : 0;
              return (
                <li key={c.channel}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{CHANNEL_LABELS[c.channel]}</span>
                    <span className="text-encre/70">{pct} %</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-creme"><div className="h-2.5 rounded-full bg-symbole" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-xs text-encre/60">{formatMoney(c.revenueMinor, "DZD")} · {c.orders} commande{c.orders > 1 ? "s" : ""}</p>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 rounded-xl bg-creme/70 p-3 text-sm">
            <p className="font-semibold">Revendeurs France</p>
            <p className="text-encre/70">{stats.france.orders > 0 && stats.france.currency ? `${formatMoney(stats.france.revenueMinor, stats.france.currency)} · ${stats.france.orders} commande(s)` : "Aucune commande sur la période."}</p>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="top" className="rounded-2xl border border-sable bg-white p-5 shadow-sm">
          <h2 id="top" className="text-xl">Produits les plus vendus</h2>
          {stats.top.length === 0 ? (
            <p className="mt-3 text-encre/60">Pas encore de vente sur la période.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {stats.top.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-creme text-xs font-semibold text-marron">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{p.name}</span>
                      <span className="shrink-0 text-encre/70">{p.quantity} vendu{p.quantity > 1 ? "s" : ""}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-creme"><div className="h-1.5 rounded-full bg-symbole" style={{ width: `${(p.quantity / (stats.top[0]?.quantity || 1)) * 100}%` }} /></div>
                    <p className="mt-0.5 text-xs text-encre/60">{formatMoney(p.revenueMinor, "DZD")}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section aria-labelledby="recent" className="rounded-2xl border border-sable bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 id="recent" className="text-xl">Dernières commandes</h2>
            <Link href="/admin/commandes" className="text-sm font-semibold text-titre underline">Tout voir</Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="mt-3 text-encre/60">Aucune commande pour le moment.</p>
          ) : (
            <ul className="mt-3 divide-y divide-sable/60">
              {stats.recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/commandes/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-creme/40">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{o.company_name ?? o.customer_name}</p>
                      <p className="text-xs text-encre/60">{o.reference} · {CHANNEL_LABELS[o.channel as keyof typeof CHANNEL_LABELS]} · {new Date(o.created_at).toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold">{formatMoney(o.total_minor, o.currency)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.status === "nouvelle" ? "bg-rose/70 text-erreur" : "bg-creme text-marron"}`}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] ?? o.status}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <details className="rounded-2xl border border-sable bg-white p-5">
        <summary className="cursor-pointer text-xl font-serif text-marron">Configuration du site ({checks.filter((c) => c.ok).length}/{checks.length} réglages faits)</summary>
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.text} className="flex items-center gap-3 text-sm">
              <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full ${c.ok ? "bg-succes" : "bg-erreur"}`} />
              <span className="sr-only">{c.ok ? "Fait :" : "À faire :"}</span>
              <Link href={c.href} prefetch={false} className="underline">{c.text}</Link>
            </li>
          ))}
        </ul>
        {noWeight.length > 0 && (
          <div className="mt-3"><Notice tone="warning">Sans poids d&apos;expédition, le colisage revendeurs est bloqué pour : {noWeight.map((s) => s.sku).join(", ")}.</Notice></div>
        )}
      </details>
    </div>
  );
}

/** Carte indicateur : valeur, et évolution par rapport aux 30 jours précédents (hausse = bon). */
function Kpi({ label, value, current, previous, hero = false }: { label: string; value: string; current: number; previous: number; hero?: boolean }) {
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  return (
    <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${hero ? "border-symbole/30 bg-gradient-to-br from-creme to-white" : "border-sable bg-white"}`}>
      <p className="text-sm text-encre/70">{label}</p>
      <p className={`mt-1 font-semibold tracking-tight text-encre ${hero ? "text-2xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{value}</p>
      <p className="mt-2 text-xs">
        {delta === null ? (
          <span className="text-encre/50">{current > 0 ? "Pas de période précédente à comparer" : "—"}</span>
        ) : (
          <span className={up ? "text-succes" : down ? "text-erreur" : "text-encre/60"}>
            <span aria-hidden="true">{up ? "▲" : down ? "▼" : "■"}</span> {up ? "+" : ""}{delta} %<span className="text-encre/50"> vs 30 j précédents</span>
          </span>
        )}
      </p>
    </div>
  );
}
