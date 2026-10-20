import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { SANITY_CACHE_TAG } from "@/lib/sanity/client";
import { getSanityRevalidateSecret } from "@/lib/server/secrets";

/** Webhook Sanity : rafraîchit les pages publiques après une publication (signature vérifiée). */
export async function POST(request: NextRequest) {
  const secret = getSanityRevalidateSecret();
  if (!secret) return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  const { isValidSignature } = await parseBody(request, secret);
  if (!isValidSignature) return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  revalidateTag(SANITY_CACHE_TAG, "max");
  return NextResponse.json({ revalidated: true });
}
