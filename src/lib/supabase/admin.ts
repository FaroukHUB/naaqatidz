import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { ConfigurationError, getSupabaseSecretKey } from "@/lib/server/secrets";

/**
 * Client « service » (clé secrète, contourne la RLS). Serveur uniquement, pour :
 * création atomique des commandes, lecture des paramètres de livraison, limitation de débit,
 * création des comptes revendeurs par l'administration (après vérification du rôle).
 */
export function createServiceClient() {
  const key = getSupabaseSecretKey();
  if (!publicEnv.supabaseUrl || !key) {
    throw new ConfigurationError("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).");
  }
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
