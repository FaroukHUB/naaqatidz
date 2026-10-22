import { NextResponse } from "next/server";
import { placeOrder, resellerChannel } from "@/lib/server/orders";
import { getOrderDeps, PRIVATE_HEADERS, readJson, serverError } from "@/lib/server/context";
import { getViewer } from "@/lib/server/viewer";
import { createServiceClient } from "@/lib/supabase/admin";

/** Mémorise l'adresse de la commande comme adresse habituelle du revendeur (pré-remplissage suivant). */
async function rememberAddress(userId: string, reference: string) {
  const service = createServiceClient();
  const { data: o } = await service
    .from("orders")
    .select("ship_country, ship_wilaya_code, ship_commune_code, ship_city, ship_postal_code, ship_address, ship_notes, customer_phone, customer_name, company_name")
    .eq("reference", reference)
    .eq("user_id", userId)
    .maybeSingle();
  if (!o) return;
  const { data: p } = await service.from("profiles").select("phone, contact_name, company_name").eq("id", userId).maybeSingle();
  await service
    .from("profiles")
    .update({
      ship_country: o.ship_country, ship_wilaya_code: o.ship_wilaya_code, ship_commune_code: o.ship_commune_code,
      ship_city: o.ship_city, ship_postal_code: o.ship_postal_code, ship_address: o.ship_address, ship_notes: o.ship_notes,
      // Coordonnées complétées seulement si elles manquaient sur le compte.
      phone: p?.phone || o.customer_phone, contact_name: p?.contact_name || o.customer_name, company_name: p?.company_name || o.company_name,
    })
    .eq("id", userId);
}

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    const channel = resellerChannel(viewer);
    if (!channel) return NextResponse.json({ error: "Accès réservé aux revendeurs validés." }, { status: 403, headers: PRIVATE_HEADERS });
    const deps = getOrderDeps();
    if (!(await deps.store.consumeRateLimit("reseller-order", viewer!.userId, 3600, 60))) {
      return NextResponse.json({ error: "Trop de commandes envoyées. Réessayez plus tard." }, { status: 429, headers: PRIVATE_HEADERS });
    }
    const body = await readJson(request).catch(() => null);
    const result = await placeOrder(channel, viewer, body, deps);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors, issues: result.issues, quote: result.quote }, { status: result.status, headers: PRIVATE_HEADERS });
    }
    // Échec non bloquant : la commande est enregistrée même si l'adresse n'a pas pu être mémorisée.
    await rememberAddress(viewer!.userId, result.reference).catch(() => {});
    return NextResponse.json({ reference: result.reference }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return serverError(err, "commande-revendeur");
  }
}
