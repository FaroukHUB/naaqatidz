import { getViewer } from "@/lib/server/viewer";
import { createSupabaseStore } from "@/lib/server/supabase-store";
import { franceMissingTerms } from "@/lib/domain/quote";
import { listWilayas } from "@/lib/geo/algeria";
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
  return (
    <div>
      <h1 className="text-3xl">Panier revendeur</h1>
      <ResellerCheckout
        scope={`revendeur-${viewer.userId}`}
        profile={viewer.pricingProfile}
        wilayas={listWilayas().map((w) => ({ code: w.code, name: w.nameFr }))}
        defaults={{ contactName: viewer.contactName ?? "", companyName: viewer.companyName ?? "", phone: viewer.phone ?? "" }}
        france={france}
      />
    </div>
  );
}
