import type { Metadata } from "next";
import Link from "next/link";
import { content } from "@/lib/catalog";
import { formatMoney, toMajor } from "@/lib/domain/money";
import { saveFrancePrices } from "@/lib/actions/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/Notice";
import { Flash } from "../Flash";

export const metadata: Metadata = { title: "Tarifs revendeurs France" };

export default async function FrancePricesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const flash = await searchParams;
  const supabase = await createSessionClient();
  const [{ data: settings }, { data: prices }, skus] = await Promise.all([
    supabase.from("commerce_settings").select("fr_currency").eq("id", 1).single(),
    supabase.from("reseller_prices").select("sku, unit_price_minor, currency, updated_at").eq("market", "FR"),
    content.listAllSkus().catch(() => []),
  ]);
  const currency = (settings?.fr_currency as string | null) ?? null;
  const bySku = new Map((prices ?? []).map((p) => [p.sku as string, p]));

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Tarifs revendeurs France</h1>
      <Flash params={flash} />
      <p className="max-w-prose text-sm text-encre/80">
        Tarifs confidentiels, visibles uniquement par les revendeurs dont le pays de résidence France a été validé. Ils ne sont jamais calculés
        à partir des prix algériens : une référence sans tarif ne peut pas être commandée par un revendeur France. Laissez vide pour retirer un tarif.
      </p>
      {!currency ? (
        <Notice tone="warning" title="Devise à confirmer">Renseignez la devise France dans les <Link href="/admin/parametres" className="underline">paramètres</Link> avant de saisir des tarifs.</Notice>
      ) : (
        <form action={saveFrancePrices} className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-sable bg-white">
            <table className="table-admin">
              <thead><tr><th>Produit</th><th>SKU</th><th>Prix public DZD (rappel)</th><th>Tarif France ({currency})</th><th>État</th></tr></thead>
              <tbody>
                {skus.map((s) => {
                  const p = bySku.get(s.sku);
                  const mismatch = p && p.currency !== currency;
                  return (
                    <tr key={s.sku}>
                      <td>{s.productName}{s.variantLabel ? ` — ${s.variantLabel}` : ""}{!s.saleable && <span className="block text-xs text-encre/60">vente non active</span>}</td>
                      <td className="font-mono text-xs">{s.sku}</td>
                      <td>{s.priceDzdMinor !== null ? formatMoney(s.priceDzdMinor, "DZD") : "—"}</td>
                      <td>
                        <input
                          name={`prix:${s.sku}`}
                          aria-label={`Tarif France ${s.sku}`}
                          inputMode="decimal"
                          className="field min-h-10 w-32 py-1"
                          defaultValue={p && !mismatch ? String(toMajor(Number(p.unit_price_minor), currency)) : ""}
                        />
                      </td>
                      <td className="text-xs">{mismatch ? <span className="text-erreur">devise {p.currency} ≠ {currency} : à ressaisir</span> : p ? `modifié le ${new Date(p.updated_at).toLocaleDateString("fr-FR")}` : <span className="text-erreur">non configuré</span>}</td>
                    </tr>
                  );
                })}
                {skus.length === 0 && <tr><td colSpan={5}>Aucune référence dans le catalogue.</td></tr>}
              </tbody>
            </table>
          </div>
          <button className="btn-primary btn-small">Enregistrer les tarifs</button>
        </form>
      )}
    </div>
  );
}
