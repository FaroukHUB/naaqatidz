import type { Metadata } from "next";
import { formatMoney, toMajor } from "@/lib/domain/money";
import { createZone, deleteCommuneOverride, deleteZone, saveCommuneOverride, saveMethod, saveRate, saveWilayas } from "@/lib/actions/admin";
import { geoMeta, getCommune, listWilayas } from "@/lib/geo/algeria";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../Flash";

export const metadata: Metadata = { title: "Livraison" };

const MODES = { per_order: "Montant par commande", per_carton: "Montant par carton (revendeurs)", weight_brackets: "Tranches de poids" } as const;

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const flash = await searchParams;
  const supabase = await createSessionClient();
  const [{ data: zones }, { data: wilayaRows }, { data: overrides }, { data: methods }, { data: rates }] = await Promise.all([
    supabase.from("shipping_zones").select("*").order("name"),
    supabase.from("shipping_wilaya_settings").select("*"),
    supabase.from("shipping_commune_overrides").select("*").order("commune_code"),
    supabase.from("shipping_methods").select("*").order("sort_order"),
    supabase.from("shipping_rates").select("*"),
  ]);
  const ws = new Map((wilayaRows ?? []).map((w) => [w.wilaya_code as string, w]));
  const zoneName = new Map((zones ?? []).map((z) => [z.id as string, z.name as string]));
  const wilayas = listWilayas();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl">Livraison en Algérie</h1>
      <Flash params={flash} />
      <p className="max-w-prose text-sm text-encre/80">
        Rien n&apos;est desservi par défaut. Activez les wilayas réellement desservies, regroupez-les en zones tarifaires, puis définissez les
        modes de livraison et leurs tarifs selon les conditions réelles de votre transporteur. Sans tarif applicable, la livraison n&apos;est jamais
        présentée comme gratuite.
      </p>

      <section className="card space-y-3 p-4">
        <h2 className="text-2xl">1. Zones tarifaires</h2>
        <ul className="flex flex-wrap gap-2">
          {(zones ?? []).map((z) => (
            <li key={z.id} className="flex items-center gap-2 rounded-full bg-creme px-3 py-1 text-sm">
              {z.name}
              <form action={deleteZone}><input type="hidden" name="zone_id" value={z.id} /><button className="text-xs text-erreur underline" aria-label={`Supprimer la zone ${z.name}`}>×</button></form>
            </li>
          ))}
          {!zones?.length && <li className="text-sm">Aucune zone.</li>}
        </ul>
        <form action={createZone} className="flex flex-wrap items-end gap-2">
          <div><label htmlFor="zname" className="field-label">Nouvelle zone</label><input id="zname" name="name" className="field" placeholder="ex. Zone 1" /></div>
          <button className="btn-secondary btn-small">Ajouter</button>
        </form>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-2xl">2. Modes de livraison</h2>
        {[...(methods ?? []), null].map((m) => (
          <form key={m?.id ?? "new"} action={saveMethod} className="grid gap-2 border-b border-sable pb-3 sm:grid-cols-6">
            <input type="hidden" name="method_id" value={m?.id ?? ""} />
            <div className="sm:col-span-2"><label className="field-label">{m ? "Nom" : "Nouveau mode"}</label><input name="label" defaultValue={m?.label ?? ""} className="field" placeholder="ex. Livraison à domicile" /></div>
            <div><label className="field-label">Transporteur</label><input name="carrier" defaultValue={m?.carrier ?? ""} className="field" placeholder="ex. Maystro" /></div>
            <div><label className="field-label">Ordre</label><input name="sort_order" defaultValue={m?.sort_order ?? 0} inputMode="numeric" className="field" /></div>
            <div className="space-y-1 text-sm sm:col-span-2">
              <span className="field-label">Proposé aux</span>
              <label className="flex items-center gap-2"><input type="checkbox" name="audience:retail" defaultChecked={m?.audiences?.includes("retail")} /> Particuliers</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="audience:reseller_dz" defaultChecked={m?.audiences?.includes("reseller_dz")} /> Revendeurs Algérie</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={m?.active ?? false} /> Actif</label>
            </div>
            <div className="sm:col-span-5"><label className="field-label">Description affichée</label><input name="description" defaultValue={m?.description ?? ""} className="field" /></div>
            <div className="flex items-end"><button className="btn-secondary btn-small w-full">{m ? "Enregistrer" : "Ajouter"}</button></div>
          </form>
        ))}
        <p className="text-xs text-encre/70">Le transporteur des particuliers n&apos;étant pas confirmé, aucun mode n&apos;est imposé.</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-2xl">3. Tarifs par mode et par zone (DZD)</h2>
        <p className="text-xs text-encre/70">Tranches de poids : une ligne par tranche « poids max en grammes = montant », ex. « 1000 = 400 ». Le poids utilisé est la somme des poids d&apos;expédition (plus les tares pour les revendeurs).</p>
        {!methods?.length || !zones?.length ? (
          <p className="text-sm">Créez d&apos;abord au moins une zone et un mode de livraison.</p>
        ) : (
          methods.map((m) => (
            <div key={m.id} className="space-y-2">
              <h3 className="text-lg">{m.label}</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {zones.map((z) => {
                  const r = (rates ?? []).find((x) => x.method_id === m.id && x.zone_id === z.id);
                  return (
                    <form key={z.id} action={saveRate} className="space-y-2 rounded-md bg-creme p-3 text-sm">
                      <input type="hidden" name="method_id" value={m.id} />
                      <input type="hidden" name="zone_id" value={z.id} />
                      <p className="font-semibold">
                        {z.name} : {r ? (r.billing_mode === "weight_brackets" ? "tranches" : formatMoney(Number(r.amount_minor), "DZD")) : "aucun tarif"}
                        {r && !r.active ? " (inactif)" : ""}
                      </p>
                      <select name="billing_mode" defaultValue={r?.billing_mode ?? "none"} className="field" aria-label="Mode de facturation">
                        <option value="none">Pas de tarif</option>
                        {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input name="amount" inputMode="decimal" placeholder="Montant (DZD)" aria-label="Montant en DZD" defaultValue={r?.amount_minor != null ? String(toMajor(Number(r.amount_minor), "DZD")) : ""} className="field" />
                      <textarea name="brackets" rows={2} placeholder="Tranches (si tranches de poids)" aria-label="Tranches de poids" defaultValue={(r?.brackets as { maxWeightG: number; amountMinor: number }[] | null)?.map((b) => `${b.maxWeightG} = ${toMajor(b.amountMinor, "DZD")}`).join("\n") ?? ""} className="field" />
                      <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} /> Actif</label>
                      <button className="btn-secondary btn-small">Enregistrer</button>
                    </form>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-2xl">4. Wilayas desservies</h2>
        <p className="text-xs text-encre/70">
          Référentiel : {geoMeta.wilayaCount} wilayas, {geoMeta.communeCount} communes (voir docs/referentiel-geographique.md). La présence d&apos;une wilaya dans cette liste ne signifie pas qu&apos;elle est desservie.
        </p>
        <form action={saveWilayas} className="space-y-3">
          <div className="max-h-[32rem] overflow-y-auto rounded-md border border-sable">
            <table className="table-admin">
              <thead className="sticky top-0 bg-white"><tr><th>Wilaya</th><th>Desservie</th><th>Zone</th></tr></thead>
              <tbody>
                {wilayas.map((w) => {
                  const row = ws.get(w.code);
                  return (
                    <tr key={w.code}>
                      <td><input type="hidden" name="wilaya" value={w.code} />{w.code} — {w.nameFr}{w.formerCode ? <span className="text-xs text-encre/60"> (ex-{w.formerCode})</span> : null}</td>
                      <td><input type="checkbox" name={`enabled:${w.code}`} defaultChecked={row?.enabled ?? false} aria-label={`${w.nameFr} desservie`} className="h-5 w-5" /></td>
                      <td>
                        <select name={`zone:${w.code}`} defaultValue={row?.zone_id ?? ""} className="field min-h-9 py-1" aria-label={`Zone ${w.nameFr}`}>
                          <option value="">—</option>
                          {(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="btn-primary btn-small">Enregistrer les wilayas</button>
        </form>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-2xl">5. Exceptions par commune</h2>
        <ul className="space-y-1 text-sm">
          {(overrides ?? []).map((o) => {
            const c = getCommune(o.commune_code);
            return (
              <li key={o.commune_code} className="flex flex-wrap items-center gap-2">
                <span>{o.commune_code} — {c?.nameFr ?? "?"} : {o.enabled === null ? "hérite de la wilaya" : o.enabled ? "desservie" : "non desservie"}{o.zone_id ? ` · zone ${zoneName.get(o.zone_id) ?? "?"}` : ""}{o.note ? ` · ${o.note}` : ""}</span>
                <form action={deleteCommuneOverride}><input type="hidden" name="commune_code" value={o.commune_code} /><button className="text-xs text-erreur underline">Supprimer</button></form>
              </li>
            );
          })}
          {!overrides?.length && <li>Aucune exception.</li>}
        </ul>
        <form action={saveCommuneOverride} className="grid gap-2 sm:grid-cols-5">
          <div><label htmlFor="cc" className="field-label">Code commune</label><input id="cc" name="commune_code" inputMode="numeric" maxLength={4} className="field" placeholder="ex. 1601" /></div>
          <div>
            <label htmlFor="ce" className="field-label">Desserte</label>
            <select id="ce" name="enabled" className="field"><option value="">Hérite de la wilaya</option><option value="on">Desservie</option><option value="off">Non desservie</option></select>
          </div>
          <div>
            <label htmlFor="cz" className="field-label">Zone</label>
            <select id="cz" name="zone_id" className="field"><option value="">Hérite</option>{(zones ?? []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
          </div>
          <div><label htmlFor="cn" className="field-label">Note</label><input id="cn" name="note" className="field" /></div>
          <div className="flex items-end"><button className="btn-secondary btn-small w-full">Enregistrer</button></div>
        </form>
      </section>
    </div>
  );
}
