import type { Metadata } from "next";
import { toMajor } from "@/lib/domain/money";
import { saveSettings } from "@/lib/actions/admin";
import { mapSettings, type SettingsRow } from "@/lib/server/commerce-store";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../Flash";

export const metadata: Metadata = { title: "Paramètres commerciaux" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const flash = await searchParams;
  const supabase = await createSessionClient();
  const { data } = await supabase.from("commerce_settings").select("*").eq("id", 1).single();
  const s = mapSettings(data as SettingsRow);
  const fr = s.france;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl">Paramètres commerciaux</h1>
      <Flash params={flash} />
      <form action={saveSettings} className="space-y-6">
        <fieldset className="card grid gap-4 p-4 sm:grid-cols-2">
          <legend className="px-1 font-serif text-xl text-marron">Particuliers</legend>
          <div>
            <label htmlFor="retail" className="field-label">Pièces maximum par référence</label>
            <input id="retail" name="retail_max_units_per_sku" inputMode="numeric" defaultValue={s.retailMaxUnitsPerSku} className="field" />
            <p className="mt-1 text-xs text-encre/70">Règle transmise : 5.</p>
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <input id="allow" name="allow_orders_without_shipping_rate" type="checkbox" defaultChecked={s.allowOrdersWithoutShippingRate} className="mt-1 h-5 w-5" />
            <label htmlFor="allow" className="text-sm">
              Accepter les commandes Algérie lorsque la destination est desservie mais qu&apos;aucun tarif ne s&apos;applique. La livraison est alors
              affichée « à confirmer » et le total comme « hors livraison ». Désactivé : la commande est refusée.
            </label>
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-4 sm:grid-cols-2">
          <legend className="px-1 font-serif text-xl text-marron">Colisage revendeurs Algérie</legend>
          <div>
            <label htmlFor="perSku" className="field-label">Unités max d&apos;une même référence par carton</label>
            <input id="perSku" name="carton_max_units_per_sku" inputMode="numeric" defaultValue={s.packing.maxUnitsPerSkuPerCarton} className="field" />
          </div>
          <div>
            <label htmlFor="maxW" className="field-label">Poids max par carton (g, tout compris)</label>
            <input id="maxW" name="carton_max_weight_g" inputMode="numeric" defaultValue={s.packing.maxCartonWeightG} className="field" />
          </div>
          <div>
            <label htmlFor="tare" className="field-label">Tare du carton vide (g)</label>
            <input id="tare" name="carton_tare_g" inputMode="numeric" defaultValue={s.packing.cartonTareG ?? ""} placeholder="à renseigner" className="field" />
          </div>
          <div>
            <label htmlFor="margin" className="field-label">Marge de protection (g)</label>
            <input id="margin" name="carton_safety_margin_g" inputMode="numeric" defaultValue={s.packing.safetyMarginG ?? ""} placeholder="à renseigner" className="field" />
          </div>
          <p className="text-xs text-encre/70 sm:col-span-2">Tant que la tare et la marge ne sont pas renseignées (0 est une valeur possible), les commandes revendeurs Algérie sont bloquées.</p>
        </fieldset>

        <fieldset className="card grid gap-4 p-4 sm:grid-cols-2">
          <legend className="px-1 font-serif text-xl text-marron">Revendeurs France (à confirmer)</legend>
          <div>
            <label htmlFor="cur" className="field-label">Devise (code ISO, ex. EUR)</label>
            <input id="cur" name="fr_currency" maxLength={3} defaultValue={fr.currency ?? ""} className="field uppercase" />
          </div>
          <div>
            <label htmlFor="mode" className="field-label">Frais d&apos;expédition</label>
            <select id="mode" name="fr_shipping_fee_mode" defaultValue={fr.shippingFeeMode ?? ""} className="field">
              <option value="">À confirmer</option>
              <option value="on_quote">Communiqués après la commande</option>
              <option value="fixed">Montant fixe par commande</option>
            </select>
          </div>
          <div>
            <label htmlFor="fee" className="field-label">Montant fixe (si « montant fixe »)</label>
            <input id="fee" name="fr_shipping_fee" inputMode="decimal" defaultValue={fr.shippingFeeMinor !== null && fr.currency ? String(toMajor(fr.shippingFeeMinor, fr.currency)) : ""} className="field" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pay" className="field-label">Conditions de paiement (affichées aux revendeurs France)</label>
            <textarea id="pay" name="fr_payment_terms" defaultValue={fr.paymentTerms ?? ""} rows={2} className="field" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ship" className="field-label">Conditions et destinations d&apos;expédition</label>
            <textarea id="ship" name="fr_shipping_terms" defaultValue={fr.shippingTerms ?? ""} rows={2} className="field" />
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <input id="open" name="fr_orders_enabled" type="checkbox" defaultChecked={fr.ordersEnabled} className="mt-1 h-5 w-5" />
            <label htmlFor="open" className="text-sm font-semibold">Ouvrir les commandes fermes France (uniquement une fois ces conditions validées par Naaqati)</label>
          </div>
        </fieldset>
        <button className="btn-primary">Enregistrer les paramètres</button>
      </form>
    </div>
  );
}
