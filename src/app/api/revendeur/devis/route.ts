import { NextResponse } from "next/server";
import { computeQuote, resellerChannel } from "@/lib/server/orders";
import { getOrderDeps, PRIVATE_HEADERS, readJson, serverError } from "@/lib/server/context";
import { getViewer } from "@/lib/server/viewer";

/** Devis revendeur : le profil tarifaire vient exclusivement du compte validé. */
export async function POST(request: Request) {
  try {
    const channel = resellerChannel(await getViewer());
    if (!channel) return NextResponse.json({ error: "Accès réservé aux revendeurs validés." }, { status: 403, headers: PRIVATE_HEADERS });
    const body = await readJson(request).catch(() => null);
    const result = await computeQuote(channel, body, getOrderDeps());
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
    return NextResponse.json({ quote: result.quote }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return serverError(err, "devis-revendeur");
  }
}
