import Link from "next/link";
import { content } from "@/lib/catalog";
import { isSanityConfigured } from "@/lib/env";
import { franceMissingTerms } from "@/lib/domain/quote";
import { mapSettings, type SettingsRow } from "@/lib/server/commerce-store";
import { createSessionClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/Notice";

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

  return (
    <div className="space-y-8">
      <h1 className="text-3xl">Tableau de bord</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/commandes?statut=nouvelle" className="card p-4 hover:shadow-md">
          <p className="text-4xl font-semibold text-symbole">{newOrders ?? 0}</p>
          <p>Nouvelle(s) commande(s) à traiter</p>
        </Link>
        <Link href="/admin/revendeurs" className="card p-4 hover:shadow-md">
          <p className="text-4xl font-semibold text-symbole">{pending ?? 0}</p>
          <p>Compte(s) revendeur en attente de validation</p>
        </Link>
        <Link href="/studio" prefetch={false} className="card p-4 hover:shadow-md">
          <p className="font-semibold text-symbole">Sanity Studio ↗</p>
          <p className="text-sm">Produits, variantes et SKU, prix publics, poids, photos, catégories, textes des pages.</p>
        </Link>
      </div>
      <section>
        <h2 className="text-2xl">Où faire quoi ?</h2>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <li className="card p-3"><strong>Sanity Studio</strong> : ajouter/modifier/archiver un produit, ses variantes et SKU, ses photos, son prix public DZD, son poids d&apos;expédition, activer/désactiver la vente, gérer les catégories et leur ordre, textes des pages.</li>
          <li className="card p-3"><strong>Ce tableau de bord</strong> : commandes, statuts, suivi, cartons, comptes revendeurs et pays, tarifs France, livraison (destinations, zones, tarifs), paramètres commerciaux.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl">Configuration avant mise en vente</h2>
        <ul className="mt-2 space-y-2">
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
      </section>
    </div>
  );
}
