import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { content } from "@/lib/catalog";
import { resolveAddress } from "@/lib/geo/algeria";
import { createSupabaseStore } from "./supabase-store";
import { ConfigurationError, getOrderTokenSecret } from "./secrets";
import type { OrderDeps } from "./orders";

export function getOrderDeps(): OrderDeps {
  return { catalog: content, store: createSupabaseStore(), geo: { resolveAddress }, tokenSecret: getOrderTokenSecret() };
}

/** Empreinte de l'adresse IP (jamais stockée en clair) pour la limitation de débit. */
export function clientKey(request: Request): string {
  return clientKeyFromHeaders(request.headers);
}

/** Même empreinte, à partir des en-têtes (actions serveur). */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || "inconnue";
  return createHash("sha256").update(`${process.env.ORDER_TOKEN_SECRET ?? ""}:${ip}`).digest("hex");
}

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

/** Erreur générique : aucun détail technique ni donnée personnelle dans la réponse ou les journaux. */
export function serverError(err: unknown, where: string): NextResponse {
  if (err instanceof ConfigurationError) {
    console.error(`[${where}] configuration incomplète`);
    return NextResponse.json({ error: "Ce service n'est pas encore configuré. Merci de réessayer plus tard ou de nous contacter." }, { status: 503, headers: PRIVATE_HEADERS });
  }
  console.error(`[${where}] erreur`, err instanceof Error ? err.name : "inconnue");
  return NextResponse.json({ error: "Une erreur est survenue. Merci de réessayer." }, { status: 500, headers: PRIVATE_HEADERS });
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 100_000) throw new Error("payload_too_large");
  return JSON.parse(text);
}
