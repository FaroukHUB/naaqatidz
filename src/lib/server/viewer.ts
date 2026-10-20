import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import type { Viewer } from "./orders";

export interface ViewerProfile extends Viewer {
  email: string | null;
  validatedCountry: "DZ" | "FR" | null;
  contactName: string | null;
  companyName: string | null;
  phone: string | null;
}

/** Utilisateur connecté et son profil, lus via la session (cookies) et la RLS. */
export async function getViewer(): Promise<ViewerProfile | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("id, email, role, status, pricing_profile, validated_country, contact_name, company_name, phone")
    .eq("id", sub)
    .maybeSingle();
  if (!p) return null;
  return {
    userId: p.id,
    email: p.email,
    role: p.role,
    status: p.status,
    pricingProfile: p.pricing_profile,
    validatedCountry: p.validated_country,
    contactName: p.contact_name,
    companyName: p.company_name,
    phone: p.phone,
  };
}

export async function requireAdmin(next = "/admin"): Promise<ViewerProfile> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  if (viewer.role !== "admin" || viewer.status !== "active") redirect("/connexion?erreur=acces");
  return viewer;
}
