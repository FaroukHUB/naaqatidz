"use server";

import { redirect } from "next/navigation";
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
