import { getViewer } from "@/lib/server/viewer";
import { RESELLER_SCOPE } from "@/components/cart/scopes";
import { resellerCatalog } from "@/lib/server/reseller";
import { QuickOrder } from "./QuickOrder";

export default async function ResellerCatalogPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "active" || !viewer.pricingProfile) return null;
  const { rows, currency } = await resellerCatalog(viewer);
  return (
    <div>
      <h1 className="text-3xl">Catalogue revendeur</h1>
      <p className="mt-2 text-encre/80">
        {viewer.pricingProfile === "reseller_fr"
          ? `Tarifs revendeurs France${currency ? ` en ${currency}` : " (devise à confirmer)"}. Une référence sans tarif configuré ne peut pas être commandée.`
          : "Prix publics en DZD. Pas de limite de quantité ; les commandes sont réparties automatiquement en cartons."}
      </p>
      <QuickOrder rows={rows} scope={RESELLER_SCOPE} />
    </div>
  );
}
