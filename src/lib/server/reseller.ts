import "server-only";
import { content } from "@/lib/catalog";
import { createSessionClient } from "@/lib/supabase/server";
import { createSupabaseStore } from "./supabase-store";
import type { ViewerProfile } from "./viewer";

export interface ResellerCatalogRow {
  sku: string;
  productName: string;
  productSlug: string;
  variantLabel: string | null;
  imageUrl: string | null;
  unitPriceMinor: number | null;
  currency: string | null;
}

/**
 * Catalogue avec les prix autorisés pour le compte connecté.
 * Revendeur Algérie : prix publics DZD. Revendeur France : tarifs France lus avec la session
 * de l'utilisateur (la RLS refuse ces lignes à tout autre profil).
 */
export async function resellerCatalog(viewer: ViewerProfile): Promise<{ rows: ResellerCatalogRow[]; currency: string | null }> {
  const skus = (await content.listAllSkus()).filter((s) => s.saleable);
  if (viewer.pricingProfile === "reseller_fr") {
    const supabase = await createSessionClient();
    const { data } = await supabase.from("reseller_prices").select("sku, unit_price_minor, currency").eq("market", "FR");
    const prices = new Map((data ?? []).map((r) => [r.sku as string, { minor: Number(r.unit_price_minor), currency: r.currency as string }]));
    const settings = await createSupabaseStore().getSettings();
    return {
      currency: settings.france.currency,
      rows: skus.map((s) => {
        const p = prices.get(s.sku);
        const ok = p && settings.france.currency && p.currency === settings.france.currency;
        return { sku: s.sku, productName: s.productName, productSlug: s.productSlug, variantLabel: s.variantLabel, imageUrl: s.imageUrl ?? null, unitPriceMinor: ok ? p.minor : null, currency: ok ? p.currency : null };
      }),
    };
  }
  return {
    currency: "DZD",
    rows: skus.map((s) => ({ sku: s.sku, productName: s.productName, productSlug: s.productSlug, variantLabel: s.variantLabel, imageUrl: s.imageUrl ?? null, unitPriceMinor: s.priceDzdMinor, currency: "DZD" })),
  };
}
