import "server-only";

/** Secrets serveur. Ce module ne peut pas être importé par un composant client (server-only). */
export function getSupabaseSecretKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY || null;
}

export function getOrderTokenSecret(): string {
  const secret = process.env.ORDER_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConfigurationError("ORDER_TOKEN_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return secret;
}

export function getSanityRevalidateSecret(): string | null {
  return process.env.SANITY_REVALIDATE_SECRET || null;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
