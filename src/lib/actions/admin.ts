"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { content } from "@/lib/catalog";
import { isValidCurrencyCode, toMinor } from "@/lib/domain/money";
import { validateManualPlan, type PackingItem } from "@/lib/domain/packing";
import { getCommune, resolveAddress } from "@/lib/geo/algeria";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/order-labels";
import { mapSettings, type SettingsRow } from "@/lib/server/commerce-store";
import { requireAdmin } from "@/lib/server/viewer";
import { createServiceClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Actions d'administration. Chaque action :
 *  1. vérifie côté serveur que la session est celle d'un administrateur actif ;
 *  2. écrit avec la session de l'utilisateur, donc sous contrôle des règles RLS (is_admin()).
 * Seule la création de compte utilise la clé secrète (API d'administration de Supabase Auth).
 */

function back(path: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`${path}${qs ? `?${qs}` : ""}`);
}

const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const optional = (form: FormData, key: string) => str(form, key) || null;

function intOrNull(raw: string): number | null | "invalid" {
  if (raw === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

function moneyOrNull(raw: string, currency: string): number | null | "invalid" {
  if (raw === "") return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return toMinor(n, currency);
}

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------
export async function updateOrderStatus(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(str(form, "id"));
  const status = z.enum(ORDER_STATUSES).parse(str(form, "status"));
  const paymentStatus = z.enum(PAYMENT_STATUSES).parse(str(form, "payment_status"));
  const supabase = await createSessionClient();
  const { error } = await supabase.from("orders").update({ status, payment_status: paymentStatus }).eq("id", id);
  revalidatePath(`/admin/commandes/${id}`);
  back(`/admin/commandes/${id}`, error ? { erreur: "Mise à jour impossible." } : { ok: "Statut mis à jour." });
}

export async function updateOrderNotes(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(str(form, "id"));
  const supabase = await createSessionClient();
  const { error } = await supabase.from("orders").update({ admin_notes: optional(form, "admin_notes") }).eq("id", id);
  back(`/admin/commandes/${id}`, error ? { erreur: "Enregistrement impossible." } : { ok: "Note enregistrée." });
}

export async function confirmShippingAmount(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(str(form, "id"));
  const currency = z.string().regex(/^[A-Z]{3}$/).parse(str(form, "currency"));
  const amount = moneyOrNull(str(form, "amount"), currency);
  if (amount === "invalid" || amount === null) back(`/admin/commandes/${id}`, { erreur: "Montant de livraison invalide." });
  const supabase = await createSessionClient();
  const { error } = await supabase.from("orders").update({ shipping_minor: amount, shipping_quote_status: "quoted" }).eq("id", id);
  back(`/admin/commandes/${id}`, error ? { erreur: "Enregistrement impossible." } : { ok: "Frais de livraison confirmés ; total recalculé." });
}

export async function addShipment(form: FormData) {
  const admin = await requireAdmin();
  const orderId = z.uuid().parse(str(form, "id"));
  const tracking = str(form, "tracking_number");
  if (!tracking) back(`/admin/commandes/${orderId}`, { erreur: "Indiquez une référence de suivi." });
  const carton = intOrNull(str(form, "carton_index"));
  const supabase = await createSessionClient();
  const { error } = await supabase.from("order_shipments").insert({
    order_id: orderId,
    carton_index: carton === "invalid" ? null : carton,
    carrier: optional(form, "carrier"),
    tracking_number: tracking,
    status: optional(form, "status"),
    created_by: admin.userId,
  });
  back(`/admin/commandes/${orderId}`, error ? { erreur: "Ajout impossible." } : { ok: "Suivi ajouté." });
}

export async function deleteShipment(form: FormData) {
  await requireAdmin();
  const orderId = z.uuid().parse(str(form, "id"));
  const shipmentId = z.uuid().parse(str(form, "shipment_id"));
  const supabase = await createSessionClient();
  await supabase.from("order_shipments").delete().eq("id", shipmentId).eq("order_id", orderId);
  back(`/admin/commandes/${orderId}`, { ok: "Suivi supprimé." });
}

/**
 * Ajustement manuel du colisage. Format saisi : une ligne par carton, « SKU:quantité » séparés par des virgules.
 * La répartition est revalidée (quantités identiques à la commande, 10 unités max par SKU, poids max).
 */
export async function adjustPacking(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(str(form, "id"));
  const supabase = await createSessionClient();
  const { data: order } = await supabase.from("orders").select("id, channel, packing_plan").eq("id", id).single();
  const { data: items } = await supabase.from("order_items").select("sku, quantity, unit_weight_g, product_name, variant_label").eq("order_id", id);
  if (!order || !items) back(`/admin/commandes/${id}`, { erreur: "Commande introuvable." });

  // Les contraintes utilisées sont celles enregistrées avec la commande (ou les paramètres actuels à défaut).
  let config = (order.packing_plan as { config?: Parameters<typeof validateManualPlan>[2] } | null)?.config;
  if (!config) {
    const { data: row } = await supabase.from("commerce_settings").select("*").eq("id", 1).single();
    config = mapSettings(row as SettingsRow).packing;
  }

  const cartons: { contents: { sku: string; quantity: number }[] }[] = [];
  for (const raw of str(form, "plan").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const contents = line.split(",").map((part) => {
      const [sku, qty] = part.split(":").map((s) => s.trim());
      return { sku: sku ?? "", quantity: Number(qty) };
    });
    cartons.push({ contents });
  }
  const orderItems: PackingItem[] = items.map((i) => ({ sku: i.sku, quantity: i.quantity, unitWeightG: i.unit_weight_g, label: i.variant_label ? `${i.product_name} — ${i.variant_label}` : i.product_name }));
  const result = validateManualPlan(cartons, orderItems, config);
  if (!result.ok) back(`/admin/commandes/${id}`, { erreur: `Répartition refusée : ${result.issues.map((i) => i.message).join(" ")}` });
  const { error } = await supabase.from("orders").update({ packing_plan: result.plan, packing_status: "adjusted" }).eq("id", id);
  back(`/admin/commandes/${id}`, error ? { erreur: "Enregistrement impossible." } : { ok: "Répartition validée et enregistrée." });
}

// ---------------------------------------------------------------------------
// Revendeurs
// ---------------------------------------------------------------------------
/** Adresse de livraison habituelle saisie par l'administration (facultative). */
function shippingFromForm(form: FormData, country: "DZ" | "FR"): { ok: true; value: Record<string, string | null> } | { ok: false; error: string } {
  const address = optional(form, "ship_address");
  const notes = optional(form, "ship_notes");
  if ((address?.length ?? 0) > 500 || (notes?.length ?? 0) > 500) return { ok: false, error: "Adresse trop longue." };
  if (country === "DZ") {
    const wilaya = optional(form, "ship_wilaya_code");
    const commune = optional(form, "ship_commune_code");
    if ((wilaya || commune) && !(wilaya && commune && resolveAddress(wilaya, commune))) {
      return { ok: false, error: "Choisissez la wilaya puis la commune de livraison." };
    }
    return { ok: true, value: { ship_country: "DZ", ship_wilaya_code: wilaya, ship_commune_code: commune, ship_city: null, ship_postal_code: null, ship_address: address, ship_notes: notes } };
  }
  const city = optional(form, "ship_city");
  const postal = optional(form, "ship_postal_code");
  if ((city?.length ?? 0) > 120 || (postal?.length ?? 0) > 20) return { ok: false, error: "Ville ou code postal trop long." };
  return { ok: true, value: { ship_country: "FR", ship_wilaya_code: null, ship_commune_code: null, ship_city: city, ship_postal_code: postal, ship_address: address, ship_notes: notes } };
}

const resellerSchema = z.object({
  status: z.enum(["pending", "active", "suspended"]),
  validated_country: z.enum(["DZ", "FR"]).nullable(),
  company_name: z.string().max(160).nullable(),
  contact_name: z.string().max(160).nullable(),
  phone: z.string().max(40).nullable(),
  admin_notes: z.string().max(2000).nullable(),
});

export async function updateReseller(form: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().parse(str(form, "id"));
  const parsed = resellerSchema.safeParse({
    status: str(form, "status"),
    validated_country: optional(form, "country"),
    company_name: optional(form, "company_name"),
    contact_name: optional(form, "contact_name"),
    phone: optional(form, "phone"),
    admin_notes: optional(form, "admin_notes"),
  });
  if (!parsed.success) back(`/admin/revendeurs/${id}`, { erreur: "Données invalides." });
  const v = parsed.data;
  if (v.status === "active" && !v.validated_country) back(`/admin/revendeurs/${id}`, { erreur: "Un compte actif doit avoir un pays de résidence validé." });
  const shipping = v.validated_country ? shippingFromForm(form, v.validated_country) : ({ ok: true, value: {} } as const);
  if (!shipping.ok) back(`/admin/revendeurs/${id}`, { erreur: shipping.error });
  // Le profil tarifaire découle du pays de résidence validé : il n'est jamais choisi par le revendeur.
  const pricing_profile = v.validated_country === "DZ" ? "reseller_dz" : v.validated_country === "FR" ? "reseller_fr" : null;
  const supabase = await createSessionClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...v, ...shipping.value, pricing_profile, validated_at: v.validated_country ? new Date().toISOString() : null, validated_by: v.validated_country ? admin.userId : null })
    .eq("id", id)
    .eq("role", "reseller");
  revalidatePath("/admin/revendeurs");
  back(`/admin/revendeurs/${id}`, error ? { erreur: "Enregistrement impossible." } : { ok: "Compte mis à jour." });
}

const TEMP_PASSWORD_COOKIE = "nq_mdp_provisoire";

/** Mot de passe lisible (sans caractères ambigus), facile à dicter ou à envoyer par message. */
function readablePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

/** Garde le mot de passe à afficher dans un cookie httpOnly (jamais dans une URL), le temps de le transmettre. */
async function rememberPassword(userId: string, password: string) {
  (await cookies()).set(TEMP_PASSWORD_COOKIE, `${userId}:${password}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin/revendeurs",
    maxAge: 30 * 60,
  });
}

const newResellerSchema = z.object({
  email: z.email(),
  country: z.enum(["DZ", "FR"]),
  company_name: z.string().max(160).nullable(),
  contact_name: z.string().max(160).nullable(),
  phone: z.string().max(40).nullable(),
  password: z.string().min(8).max(72).nullable(),
});

/**
 * Création d'un compte revendeur en une seule étape : le compte est actif immédiatement,
 * avec le pays (et donc les tarifs) choisi par l'administratrice.
 */
export async function createReseller(form: FormData) {
  const admin = await requireAdmin();
  const parsed = newResellerSchema.safeParse({
    email: str(form, "email").toLowerCase(),
    country: str(form, "country"),
    company_name: optional(form, "company_name"),
    contact_name: optional(form, "contact_name"),
    phone: optional(form, "phone"),
    password: optional(form, "password"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    back("/admin/revendeurs", {
      erreur: field === "email" ? "Adresse email invalide." : field === "country" ? "Choisissez le pays du revendeur." : field === "password" ? "Le mot de passe doit faire au moins 8 caractères." : "Informations invalides.",
    });
  }
  const v = parsed.data;
  const shipping = shippingFromForm(form, v.country);
  if (!shipping.ok) back("/admin/revendeurs", { erreur: shipping.error });
  const password = v.password ?? readablePassword();
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({ email: v.email, password, email_confirm: true });
  if (error || !data.user) back("/admin/revendeurs", { erreur: "Création impossible : cette adresse email a peut-être déjà un compte." });
  const supabase = await createSessionClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      status: "active",
      declared_country: v.country,
      validated_country: v.country,
      pricing_profile: v.country === "DZ" ? "reseller_dz" : "reseller_fr",
      validated_at: new Date().toISOString(),
      validated_by: admin.userId,
      company_name: v.company_name,
      contact_name: v.contact_name,
      phone: v.phone,
      ...shipping.value,
    })
    .eq("id", data.user.id)
    .eq("role", "reseller");
  if (profileError) {
    // Pas de compte à moitié créé : on supprime l'utilisateur si le profil n'a pas pu être activé.
    await service.auth.admin.deleteUser(data.user.id);
    back("/admin/revendeurs", { erreur: "Création impossible, réessayez." });
  }
  await rememberPassword(data.user.id, password);
  revalidatePath("/admin/revendeurs");
  back(`/admin/revendeurs/${data.user.id}`, { ok: "Compte créé et actif. Envoyez les identifiants ci-dessous au revendeur." });
}

/** Nouveau mot de passe pour un revendeur (oubli, ou identifiants perdus avant d'avoir été envoyés). */
export async function resetResellerPassword(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(str(form, "id"));
  const supabase = await createSessionClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", id).eq("role", "reseller").maybeSingle();
  if (!profile) back("/admin/revendeurs", { erreur: "Compte introuvable." });
  const password = readablePassword();
  const { error } = await createServiceClient().auth.admin.updateUserById(id, { password });
  if (error) back(`/admin/revendeurs/${id}`, { erreur: "Changement de mot de passe impossible." });
  await rememberPassword(id, password);
  back(`/admin/revendeurs/${id}`, { ok: "Nouveau mot de passe créé. Envoyez-le au revendeur." });
}

// ---------------------------------------------------------------------------
// Tarifs France
// ---------------------------------------------------------------------------
export async function saveFrancePrices(form: FormData) {
  const admin = await requireAdmin();
  const supabase = await createSessionClient();
  const { data: row } = await supabase.from("commerce_settings").select("fr_currency").eq("id", 1).single();
  const currency = row?.fr_currency as string | null;
  if (!currency) back("/admin/tarifs-france", { erreur: "Renseignez d'abord la devise France dans les paramètres." });
  const known = new Set((await content.listAllSkus()).map((s) => s.sku));
  const upserts: { market: string; sku: string; unit_price_minor: number; currency: string; updated_by: string }[] = [];
  const deletes: string[] = [];
  const invalid: string[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("prix:") || typeof value !== "string") continue;
    const sku = key.slice(5);
    if (!known.has(sku)) continue;
    const minor = moneyOrNull(value.trim(), currency);
    if (minor === "invalid" || minor === 0) invalid.push(sku);
    else if (minor === null) deletes.push(sku);
    else upserts.push({ market: "FR", sku, unit_price_minor: minor, currency, updated_by: admin.userId });
  }
  if (invalid.length) back("/admin/tarifs-france", { erreur: `Prix invalide pour : ${invalid.join(", ")}` });
  if (upserts.length) {
    const { error } = await supabase.from("reseller_prices").upsert(upserts, { onConflict: "market,sku" });
    if (error) back("/admin/tarifs-france", { erreur: "Enregistrement impossible." });
  }
  if (deletes.length) await supabase.from("reseller_prices").delete().eq("market", "FR").in("sku", deletes);
  back("/admin/tarifs-france", { ok: "Tarifs enregistrés." });
}

// ---------------------------------------------------------------------------
// Paramètres commerciaux
// ---------------------------------------------------------------------------
export async function saveSettings(form: FormData) {
  await requireAdmin();
  const tare = intOrNull(str(form, "carton_tare_g"));
  const margin = intOrNull(str(form, "carton_safety_margin_g"));
  const retailMax = intOrNull(str(form, "retail_max_units_per_sku"));
  const perSku = intOrNull(str(form, "carton_max_units_per_sku"));
  const maxWeight = intOrNull(str(form, "carton_max_weight_g"));
  if ([tare, margin, retailMax, perSku, maxWeight].includes("invalid") || !retailMax || !perSku || !maxWeight) {
    back("/admin/parametres", { erreur: "Valeurs numériques invalides (grammes et quantités entières)." });
  }
  const frCurrency = str(form, "fr_currency").toUpperCase() || null;
  if (frCurrency && !isValidCurrencyCode(frCurrency)) back("/admin/parametres", { erreur: "Code devise invalide (ex. EUR)." });
  const feeMode = str(form, "fr_shipping_fee_mode") || null;
  if (feeMode && feeMode !== "on_quote" && feeMode !== "fixed") back("/admin/parametres", { erreur: "Mode de frais France invalide." });
  const fee = frCurrency ? moneyOrNull(str(form, "fr_shipping_fee"), frCurrency) : null;
  if (fee === "invalid") back("/admin/parametres", { erreur: "Frais d'expédition France invalides." });

  const supabase = await createSessionClient();
  const { error } = await supabase
    .from("commerce_settings")
    .update({
      retail_max_units_per_sku: retailMax,
      carton_max_units_per_sku: perSku,
      carton_max_weight_g: maxWeight,
      carton_tare_g: tare,
      carton_safety_margin_g: margin,
      allow_orders_without_shipping_rate: form.get("allow_orders_without_shipping_rate") === "on",
      fr_currency: frCurrency,
      fr_payment_terms: optional(form, "fr_payment_terms"),
      fr_shipping_terms: optional(form, "fr_shipping_terms"),
      fr_shipping_fee_mode: feeMode,
      fr_shipping_fee_minor: feeMode === "fixed" ? fee : null,
      fr_orders_enabled: form.get("fr_orders_enabled") === "on",
    })
    .eq("id", 1);
  if (error) {
    back("/admin/parametres", {
      erreur: error.message.includes("fr_orders_require_terms")
        ? "Impossible d'ouvrir les commandes France : devise, conditions de paiement, conditions d'expédition et mode de frais doivent être renseignés."
        : "Enregistrement impossible.",
    });
  }
  back("/admin/parametres", { ok: "Paramètres enregistrés." });
}

// ---------------------------------------------------------------------------
// Livraison
// ---------------------------------------------------------------------------
export async function createZone(form: FormData) {
  await requireAdmin();
  const name = str(form, "name");
  if (!name) back("/admin/livraison", { erreur: "Nom de zone requis." });
  const supabase = await createSessionClient();
  const { error } = await supabase.from("shipping_zones").insert({ name, notes: optional(form, "notes") });
  back("/admin/livraison", error ? { erreur: "Création impossible (nom déjà utilisé ?)." } : { ok: "Zone créée." });
}

export async function deleteZone(form: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(str(form, "zone_id"));
  const supabase = await createSessionClient();
  await supabase.from("shipping_zones").delete().eq("id", id);
  back("/admin/livraison", { ok: "Zone supprimée (les wilayas concernées n'ont plus de zone)." });
}

export async function saveWilayas(form: FormData) {
  await requireAdmin();
  const codes = form.getAll("wilaya").map(String).filter((c) => /^\d{2}$/.test(c));
  const rows = codes.map((code) => ({
    wilaya_code: code,
    enabled: form.get(`enabled:${code}`) === "on",
    zone_id: str(form, `zone:${code}`) || null,
    updated_at: new Date().toISOString(),
  }));
  const supabase = await createSessionClient();
  const { error } = await supabase.from("shipping_wilaya_settings").upsert(rows, { onConflict: "wilaya_code" });
  back("/admin/livraison", error ? { erreur: "Enregistrement impossible." } : { ok: "Destinations enregistrées." });
}

export async function saveCommuneOverride(form: FormData) {
  await requireAdmin();
  const code = str(form, "commune_code");
  if (!getCommune(code)) back("/admin/livraison", { erreur: "Code commune inconnu." });
  const mode = str(form, "enabled");
  const supabase = await createSessionClient();
  const { error } = await supabase.from("shipping_commune_overrides").upsert(
    { commune_code: code, enabled: mode === "" ? null : mode === "on", zone_id: str(form, "zone_id") || null, note: optional(form, "note"), updated_at: new Date().toISOString() },
    { onConflict: "commune_code" },
  );
  back("/admin/livraison", error ? { erreur: "Enregistrement impossible." } : { ok: "Exception enregistrée." });
}

export async function deleteCommuneOverride(form: FormData) {
  await requireAdmin();
  const supabase = await createSessionClient();
  await supabase.from("shipping_commune_overrides").delete().eq("commune_code", str(form, "commune_code"));
  back("/admin/livraison", { ok: "Exception supprimée." });
}

export async function saveMethod(form: FormData) {
  await requireAdmin();
  const id = str(form, "method_id");
  const label = str(form, "label");
  if (!label) back("/admin/livraison", { erreur: "Nom du mode de livraison requis." });
  const audiences = ["retail", "reseller_dz"].filter((a) => form.get(`audience:${a}`) === "on");
  const sort = intOrNull(str(form, "sort_order"));
  const row = {
    label,
    description: optional(form, "description"),
    carrier: optional(form, "carrier"),
    audiences,
    active: form.get("active") === "on",
    sort_order: typeof sort === "number" ? sort : 0,
  };
  const supabase = await createSessionClient();
  const { error } = id ? await supabase.from("shipping_methods").update(row).eq("id", id) : await supabase.from("shipping_methods").insert(row);
  back("/admin/livraison", error ? { erreur: "Enregistrement impossible." } : { ok: "Mode de livraison enregistré." });
}

export async function saveRate(form: FormData) {
  await requireAdmin();
  const methodId = z.uuid().parse(str(form, "method_id"));
  const zoneId = z.uuid().parse(str(form, "zone_id"));
  const mode = z.enum(["per_order", "per_carton", "weight_brackets", "none"]).parse(str(form, "billing_mode"));
  const supabase = await createSessionClient();
  if (mode === "none") {
    await supabase.from("shipping_rates").delete().eq("method_id", methodId).eq("zone_id", zoneId);
    back("/admin/livraison", { ok: "Tarif supprimé." });
  }
  let amount: number | null = null;
  let brackets: { maxWeightG: number; amountMinor: number }[] | null = null;
  if (mode === "weight_brackets") {
    // Format : une tranche par ligne « poids max en grammes = montant en DZD », ex. « 1000 = 400 ».
    brackets = [];
    for (const line of str(form, "brackets").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [w, a] = line.split("=").map((s) => s.trim());
      const weight = intOrNull(w ?? "");
      const minor = moneyOrNull(a ?? "", "DZD");
      if (typeof weight !== "number" || weight <= 0 || typeof minor !== "number") back("/admin/livraison", { erreur: `Tranche invalide : « ${line} »` });
      brackets.push({ maxWeightG: weight, amountMinor: minor });
    }
    if (brackets.length === 0) back("/admin/livraison", { erreur: "Ajoutez au moins une tranche de poids." });
  } else {
    const minor = moneyOrNull(str(form, "amount"), "DZD");
    if (typeof minor !== "number") back("/admin/livraison", { erreur: "Montant invalide." });
    amount = minor;
  }
  const { error } = await supabase.from("shipping_rates").upsert(
    { method_id: methodId, zone_id: zoneId, billing_mode: mode, amount_minor: amount, brackets, active: form.get("active") === "on", updated_at: new Date().toISOString() },
    { onConflict: "method_id,zone_id" },
  );
  back("/admin/livraison", error ? { erreur: "Enregistrement impossible." } : { ok: "Tarif enregistré." });
}
