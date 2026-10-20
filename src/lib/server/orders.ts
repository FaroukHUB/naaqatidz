import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { buildQuote, type Quote } from "@/lib/domain/quote";
import type { PrivatePrice } from "@/lib/domain/pricing";
import type { CatalogSku, Channel, Issue } from "@/lib/domain/types";
import type { CommerceStore, OrderPayload } from "./commerce-store";

/**
 * Service de commande, exécuté uniquement côté serveur.
 * Le navigateur transmet des SKU, des quantités, une adresse et une clé d'idempotence.
 * Le parcours (particulier / revendeur Algérie / revendeur France) est déduit de la session,
 * jamais d'un champ envoyé par le client : les schémas sont stricts et rejettent tout champ inconnu
 * (ex. « channel », « profile », « price »).
 */

// ---------------------------------------------------------------------------
// Schémas d'entrée
// ---------------------------------------------------------------------------
const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number, msg: string) => z.string().trim().min(1, msg).max(max, "Texte trop long.");

export function normalizeAlgerianPhone(raw: string): string | null {
  let digits = raw.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+213")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("00213")) digits = `0${digits.slice(5)}`;
  if (/^0[5-7]\d{8}$/.test(digits) || /^0[2-4]\d{7}$/.test(digits)) return digits;
  return null;
}

const algerianPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeAlgerianPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone algérien invalide (ex. 0550 12 34 56)." });
      return z.NEVER;
    }
    return n;
  });

const internationalPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s.\-()]{6,25}$/, "Numéro de téléphone invalide.");

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.email("Adresse email invalide.").nullable());

const lines = z
  .array(z.strictObject({ sku: z.string().trim().min(1).max(64), quantity: z.number().int().min(1).max(100_000) }))
  .min(1, "Le panier est vide.")
  .max(300);

const algeriaAddress = z.strictObject({
  wilayaCode: z.string().regex(/^\d{2}$/, "Choisissez une wilaya."),
  communeCode: z.string().regex(/^\d{4}$/, "Choisissez une commune."),
  address: required(400, "Indiquez l'adresse de livraison."),
  notes: trimmed(500).optional(),
});

export const retailOrderSchema = z.strictObject({
  idempotencyKey: z.uuid(),
  lines,
  firstName: required(80, "Indiquez votre prénom."),
  lastName: required(80, "Indiquez votre nom."),
  phone: algerianPhone,
  email: optionalEmail,
  address: algeriaAddress,
  shippingMethodId: z.uuid().nullable(),
  /** Champ piège invisible pour les robots : doit rester vide. */
  website: z.string().max(200).optional(),
});

export const resellerDzOrderSchema = z.strictObject({
  idempotencyKey: z.uuid(),
  lines,
  contactName: required(160, "Indiquez le nom du contact."),
  companyName: trimmed(160).optional(),
  phone: algerianPhone,
  address: algeriaAddress,
  shippingMethodId: z.uuid().nullable(),
});

export const resellerFrOrderSchema = z.strictObject({
  idempotencyKey: z.uuid(),
  lines,
  contactName: required(160, "Indiquez le nom du contact."),
  companyName: trimmed(160).optional(),
  phone: internationalPhone,
  address: z.strictObject({
    country: z.string().regex(/^[A-Z]{2}$/, "Pays invalide."),
    city: required(120, "Indiquez la ville."),
    postalCode: required(20, "Indiquez le code postal."),
    address: required(400, "Indiquez l'adresse de livraison."),
    notes: trimmed(500).optional(),
  }),
});

export const quoteRequestSchema = z.strictObject({
  lines,
  destination: z.strictObject({ wilayaCode: z.string().regex(/^\d{2}$/), communeCode: z.string().regex(/^\d{4}$/) }).nullable().optional(),
  shippingMethodId: z.uuid().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Contexte
// ---------------------------------------------------------------------------
export interface Viewer {
  userId: string;
  role: "admin" | "reseller";
  status: "pending" | "active" | "suspended";
  pricingProfile: "reseller_dz" | "reseller_fr" | null;
}

/** Profil tarifaire effectif d'un compte connecté ; null si le compte n'est pas un revendeur actif validé. */
export function resellerChannel(viewer: Viewer | null): Exclude<Channel, "retail"> | null {
  if (!viewer || viewer.role !== "reseller" || viewer.status !== "active") return null;
  return viewer.pricingProfile;
}

export interface GeoResolver {
  resolveAddress(wilayaCode: string, communeCode: string): { wilaya: { code: string; nameFr: string }; commune: { code: string; nameFr: string } } | null;
}

export interface OrderDeps {
  catalog: { getSkusFresh(skus: readonly string[]): Promise<Map<string, CatalogSku>>; readonly kind: string };
  store: CommerceStore;
  geo: GeoResolver;
  tokenSecret: string;
}

export type OrderResult =
  | { ok: true; reference: string; created: boolean; confirmationToken: string | null }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string>; issues?: Issue[]; quote?: Quote };

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Jeton de confirmation dérivé de la clé d'idempotence et d'un secret serveur : identique en cas de double soumission, impossible à deviner. */
export function confirmationToken(secret: string, idempotencyKey: string): string {
  return createHmac("sha256", secret).update(`order-confirmation:${idempotencyKey}`).digest("base64url");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.code === "unrecognized_keys" ? "Champ non autorisé." : issue.message;
  }
  return out;
}

function invalid(error: z.ZodError): OrderResult {
  const unknownKeys = error.issues.some((i) => i.code === "unrecognized_keys");
  return {
    ok: false,
    status: 400,
    error: unknownKeys ? "La requête contient des champs non autorisés." : "Certaines informations sont manquantes ou invalides.",
    fieldErrors: fieldErrorsOf(error),
  };
}

async function loadFrancePrices(channel: Channel, store: CommerceStore, skus: string[]): Promise<Map<string, PrivatePrice> | undefined> {
  // Les tarifs France ne sont chargés que pour un compte France validé (canal déterminé par le serveur).
  return channel === "reseller_fr" ? store.getFrancePrices(skus) : undefined;
}

/** Devis recalculé côté serveur (panier, page de commande). */
export async function computeQuote(channel: Channel, rawInput: unknown, deps: Omit<OrderDeps, "tokenSecret">): Promise<{ ok: true; quote: Quote } | { ok: false; status: number; error: string }> {
  const parsed = quoteRequestSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, status: 400, error: "Requête invalide." };
  const input = parsed.data;
  const skus = [...new Set(input.lines.map((l) => l.sku))];
  const [catalog, settings, francePrices] = await Promise.all([
    deps.catalog.getSkusFresh(skus),
    deps.store.getSettings(),
    loadFrancePrices(channel, deps.store, skus),
  ]);
  let shipping: Parameters<typeof buildQuote>[0]["shipping"];
  if (channel !== "reseller_fr") {
    const dest = input.destination && deps.geo.resolveAddress(input.destination.wilayaCode, input.destination.communeCode);
    shipping = {
      config: await deps.store.getShippingConfig(),
      destination: dest ? { wilayaCode: dest.wilaya.code, communeCode: dest.commune.code } : null,
      methodId: input.shippingMethodId ?? null,
    };
  }
  return { ok: true, quote: buildQuote({ channel, lines: input.lines, catalog, settings, francePrices, shipping }) };
}

// ---------------------------------------------------------------------------
// Création de commande
// ---------------------------------------------------------------------------
export async function placeOrder(channel: Channel, viewer: Viewer | null, rawInput: unknown, deps: OrderDeps): Promise<OrderResult> {
  // Le canal demandé doit correspondre au profil validé de la session.
  if (channel !== "retail" && resellerChannel(viewer) !== channel) {
    return { ok: false, status: 403, error: "Ce compte n'est pas autorisé à commander avec ce profil tarifaire." };
  }

  const schema = channel === "retail" ? retailOrderSchema : channel === "reseller_dz" ? resellerDzOrderSchema : resellerFrOrderSchema;
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data as z.infer<typeof retailOrderSchema> & z.infer<typeof resellerDzOrderSchema> & z.infer<typeof resellerFrOrderSchema>;

  if (channel === "retail" && input.website) {
    return { ok: false, status: 400, error: "Soumission refusée." };
  }

  let wilaya: { code: string; nameFr: string } | null = null;
  let commune: { code: string; nameFr: string } | null = null;
  if (channel !== "reseller_fr") {
    const resolved = deps.geo.resolveAddress(input.address.wilayaCode, input.address.communeCode);
    if (!resolved) {
      return { ok: false, status: 400, error: "La commune ne correspond pas à la wilaya choisie.", fieldErrors: { "address.communeCode": "Commune invalide pour cette wilaya." } };
    }
    wilaya = resolved.wilaya;
    commune = resolved.commune;
  }

  const skus = [...new Set(input.lines.map((l) => l.sku))];
  const [catalog, settings, francePrices] = await Promise.all([
    deps.catalog.getSkusFresh(skus),
    deps.store.getSettings(),
    loadFrancePrices(channel, deps.store, skus),
  ]);
  const shipping =
    channel === "reseller_fr"
      ? undefined
      : { config: await deps.store.getShippingConfig(), destination: { wilayaCode: wilaya!.code, communeCode: commune!.code }, methodId: input.shippingMethodId ?? null };

  const quote = buildQuote({ channel, lines: input.lines, catalog, settings, francePrices, shipping });
  if (!quote.canOrder || !quote.currency) {
    return { ok: false, status: 422, error: "La commande ne peut pas être validée en l'état.", issues: quote.blockers, quote };
  }

  const { idempotencyKey, website: _honeypot, ...hashed } = input;
  void _honeypot;
  const requestHash = sha256(stableStringify({ channel, userId: viewer?.userId ?? null, ...hashed }));
  const token = channel === "retail" ? confirmationToken(deps.tokenSecret, idempotencyKey) : null;

  const sel = quote.shipping;
  const conditions: Record<string, unknown> = {
    quotedAt: new Date().toISOString(),
    catalogSource: deps.catalog.kind,
    shipping: sel,
  };
  if (channel === "retail") conditions.retailMaxUnitsPerSku = settings.retailMaxUnitsPerSku;
  if (channel === "reseller_dz") conditions.packing = settings.packing;
  if (channel === "reseller_fr") {
    conditions.france = {
      currency: settings.france.currency,
      paymentTerms: settings.france.paymentTerms,
      shippingTerms: settings.france.shippingTerms,
      shippingFeeMode: settings.france.shippingFeeMode,
    };
  }

  const payload: OrderPayload = {
    channel,
    user_id: channel === "retail" ? null : viewer!.userId,
    payment_method: channel === "reseller_fr" ? "a_definir" : "cod",
    customer_name: channel === "retail" ? `${input.firstName} ${input.lastName}` : input.contactName,
    customer_phone: input.phone,
    customer_email: channel === "retail" ? input.email : null,
    company_name: channel === "retail" ? null : input.companyName || null,
    ship_country: channel === "reseller_fr" ? input.address.country : "DZ",
    ship_wilaya_code: wilaya?.code ?? null,
    ship_wilaya_name: wilaya?.nameFr ?? null,
    ship_commune_code: commune?.code ?? null,
    ship_commune_name: commune?.nameFr ?? null,
    ship_city: channel === "reseller_fr" ? input.address.city : null,
    ship_postal_code: channel === "reseller_fr" ? input.address.postalCode : null,
    ship_address: input.address.address,
    ship_notes: input.address.notes || null,
    currency: quote.currency,
    subtotal_minor: quote.subtotalMinor,
    shipping_minor: quote.shippingMinor,
    shipping_quote_status: quote.shippingMinor !== null ? "quoted" : "to_confirm",
    shipping_method_id: sel.status === "quoted" ? sel.methodId : sel.status === "to_confirm" ? sel.methodId : null,
    shipping_method_label: sel.status === "quoted" ? sel.label : sel.status === "to_confirm" ? sel.label : channel === "reseller_fr" ? "Expédition France" : null,
    carrier: sel.status === "quoted" ? sel.carrier : null,
    conditions,
    packing_status: quote.packing ? "calculated" : "not_required",
    packing_plan: quote.packing,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    confirmation_token_hash: token ? sha256(token) : null,
    items: quote.lines.map((l) => ({
      sku: l.sku,
      product_id: l.productId,
      product_name: l.productName,
      variant_label: l.variantLabel,
      unit_price_minor: l.unitPriceMinor,
      quantity: l.quantity,
      unit_weight_g: l.shippingWeightG,
    })),
  };

  try {
    const res = await deps.store.createOrder(payload);
    return { ok: true, reference: res.reference, created: res.created, confirmationToken: token };
  } catch (err) {
    if (err instanceof Error && err.message.includes("idempotency_conflict")) {
      return { ok: false, status: 409, error: "Cette commande a déjà été envoyée avec un contenu différent. Rechargez la page." };
    }
    throw err;
  }
}
