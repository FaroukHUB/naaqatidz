/**
 * Variables d'environnement publiques (exposées au navigateur, donc jamais secrètes).
 * Les variables secrètes sont lues uniquement dans src/lib/server/secrets.ts.
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  sanityProjectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "",
  sanityDataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  sanityApiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-10-01",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export const isSanityConfigured = Boolean(publicEnv.sanityProjectId);
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);

/**
 * Données de démonstration : uniquement en développement local et uniquement si Sanity
 * n'est pas configuré. Jamais en production (next build force NODE_ENV=production).
 */
export const isDemoCatalog = !isSanityConfigured && process.env.NODE_ENV !== "production";
