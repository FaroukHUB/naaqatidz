import { getViewer } from "@/lib/server/viewer";
import { RESELLER_SCOPE } from "@/components/cart/scopes";
import { createSupabaseStore } from "@/lib/server/supabase-store";
import { franceMissingTerms } from "@/lib/domain/quote";
import { listWilayas } from "@/lib/geo/algeria";
import { createSessionClient } from "@/lib/supabase/server";
import { ResellerCheckout } from "./ResellerCheckout";

export default async function ResellerCartPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "active" || !viewer.pricingProfile) return null;
  let france: { paymentTerms: string | null; shippingTerms: string | null; missing: string[] } | null = null;
  if (viewer.pricingProfile === "reseller_fr") {
    const settings = await createSupabaseStore().getSettings();
    france = {
      paymentTerms: settings.france.paymentTerms,
      shippingTerms: settings.france.shippingTerms,
      missing: franceMissingTerms(settings).map((i) => i.message),
    };
  }
  // Adresse pré-remplie : celle du compte, sinon celle de la dernière commande.
  let ship = viewer.shipping;
  if (!ship.address) {
    const supabase = await createSessionClient();
    const { data: last } = await supabase
      .from("orders")
      .select("ship_country, ship_wilaya_code, ship_commune_code, ship_city, ship_postal_code, ship_address, ship_notes")
      .eq("user_id", viewer.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      ship = {
        country: last.ship_country, wilayaCode: last.ship_wilaya_code, communeCode: last.ship_commune_code,
        city: last.ship_city, postalCode: last.ship_postal_code, address: last.ship_address, notes: last.ship_notes,
      };
    }
  }
  return (
    <div>
      <h1 className="text-3xl">Panier revendeur</h1>
      <ResellerCheckout
        scope={RESELLER_SCOPE}
        profile={viewer.pricingProfile}
        wilayas={listWilayas().map((w) => ({ code: w.code, name: w.nameFr }))}
        defaults={{
          contactName: viewer.contactName ?? "",
          companyName: viewer.companyName ?? "",
          phone: viewer.phone ?? "",
          wilayaCode: ship.wilayaCode ?? "",
          communeCode: ship.communeCode ?? "",
          address: ship.address ?? "",
          notes: ship.notes ?? "",
          country: ship.country && ship.country !== "DZ" ? ship.country : "FR",
          city: ship.city ?? "",
          postalCode: ship.postalCode ?? "",
        }}
        france={france}
      />
    </div>
  );
}
