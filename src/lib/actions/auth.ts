"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAddress } from "@/lib/geo/algeria";
import { clientKeyFromHeaders, getOrderDeps } from "@/lib/server/context";
import { createServiceClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

export interface FormState {
  error?: string;
  message?: string;
}

const credentials = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "L'authentification n'est pas encore configurée." };
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Email ou mot de passe invalide." };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Message identique quelle que soit la cause, pour ne pas révéler l'existence d'un compte.
  if (error || !data.user) return { error: "Email ou mot de passe incorrect." };
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).maybeSingle();
  const fallback = profile?.role === "admin" && profile.status === "active" ? "/admin" : "/revendeur";
  redirect(safeNext(form.get("suite"), fallback));
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  redirect("/connexion");
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "L'authentification n'est pas encore configurée." };
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Adresse email invalide." };
  const supabase = await createSessionClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?suite=/revendeur/compte`,
  });
  return { message: "Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé." };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "Le mot de passe doit contenir au moins 10 caractères." };
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Le mot de passe n'a pas pu être modifié. Reconnectez-vous puis réessayez." };
  return { message: "Mot de passe modifié." };
}

export interface SignupState extends FormState {
  fieldErrors?: Record<string, string>;
}

const signupSchema = z.object({
  email: z.email({ message: "Adresse email invalide." }),
  password: z.string().min(8, { message: "8 caractères minimum." }).max(72),
  contact_name: z.string().trim().min(2, { message: "Indiquez votre nom." }).max(160),
  company_name: z.string().trim().max(160),
  phone: z.string().trim().regex(/^\+?[0-9 .-]{8,20}$/, { message: "Numéro de téléphone invalide." }),
  country: z.enum(["DZ", "FR"], { message: "Choisissez votre pays." }),
  ship_wilaya_code: z.string().max(2),
  ship_commune_code: z.string().max(4),
  ship_postal_code: z.string().trim().max(20),
  ship_city: z.string().trim().max(120),
  ship_address: z.string().trim().min(5, { message: "Indiquez votre adresse." }).max(500),
  website: z.string().max(0),
});

/**
 * Inscription d'un revendeur depuis le site.
 * Algérie : compte actif tout de suite (prix publics). France : en attente d'activation par Naaqati,
 * car les tarifs France sont confidentiels.
 */
export async function registerReseller(_prev: SignupState, form: FormData): Promise<SignupState> {
  if (!isSupabaseConfigured) return { error: "L'inscription n'est pas encore disponible." };
  const get = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
  const parsed = signupSchema.safeParse({
    email: get("email").trim().toLowerCase(),
    password: get("password"),
    contact_name: get("contact_name"),
    company_name: get("company_name"),
    phone: get("phone"),
    country: get("country"),
    ship_wilaya_code: get("ship_wilaya_code"),
    ship_commune_code: get("ship_commune_code"),
    ship_postal_code: get("ship_postal_code"),
    ship_city: get("ship_city"),
    ship_address: get("ship_address"),
    website: get("website"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    if (fieldErrors.website) return { error: "Inscription impossible." };
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;
  // Lieu de livraison obligatoire : wilaya + commune (Algérie), code postal + ville (France).
  if (v.country === "DZ" && !resolveAddress(v.ship_wilaya_code, v.ship_commune_code)) {
    return { error: "Vérifiez les champs indiqués.", fieldErrors: { ship_commune_code: "Choisissez votre wilaya puis votre commune." } };
  }
  if (v.country === "FR") {
    const fieldErrors: Record<string, string> = {};
    if (!/^[0-9]{5}$/.test(v.ship_postal_code)) fieldErrors.ship_postal_code = "Code postal à 5 chiffres.";
    if (v.ship_city.length < 2) fieldErrors.ship_city = "Indiquez votre ville.";
    if (Object.keys(fieldErrors).length) return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const store = getOrderDeps().store;
  if (!(await store.consumeRateLimit("reseller-signup", clientKeyFromHeaders(await headers()), 3600, 5))) {
    return { error: "Trop d'inscriptions depuis cette connexion. Réessayez dans une heure." };
  }

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({ email: v.email, password: v.password, email_confirm: true });
  if (error || !data.user) {
    return { error: "Impossible de créer le compte. Si vous avez déjà un compte avec cet email, connectez-vous ou utilisez « Mot de passe oublié »." };
  }
  const dz = v.country === "DZ";
  const { error: profileError } = await service
    .from("profiles")
    .update({
      status: dz ? "active" : "pending",
      declared_country: v.country,
      validated_country: dz ? "DZ" : null,
      pricing_profile: dz ? "reseller_dz" : null,
      validated_at: dz ? new Date().toISOString() : null,
      contact_name: v.contact_name,
      company_name: v.company_name || null,
      phone: v.phone,
      ship_country: v.country,
      ship_wilaya_code: dz ? v.ship_wilaya_code : null,
      ship_commune_code: dz ? v.ship_commune_code : null,
      ship_postal_code: dz ? null : v.ship_postal_code,
      ship_city: dz ? null : v.ship_city,
      ship_address: v.ship_address,
    })
    .eq("id", data.user.id)
    .eq("role", "reseller");
  if (profileError) {
    await service.auth.admin.deleteUser(data.user.id);
    return { error: "Impossible de créer le compte, réessayez." };
  }

  // Connexion directe après l'inscription.
  const supabase = await createSessionClient();
  await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
  redirect(dz ? "/revendeur?bienvenue=1" : "/revendeur");
}
