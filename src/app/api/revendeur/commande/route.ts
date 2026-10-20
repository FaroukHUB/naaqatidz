import { NextResponse } from "next/server";
import { placeOrder, resellerChannel } from "@/lib/server/orders";
import { getOrderDeps, PRIVATE_HEADERS, readJson, serverError } from "@/lib/server/context";
import { getViewer } from "@/lib/server/viewer";

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    const channel = resellerChannel(viewer);
    if (!channel) return NextResponse.json({ error: "Accès réservé aux revendeurs validés." }, { status: 403, headers: PRIVATE_HEADERS });
    const deps = getOrderDeps();
    if (!(await deps.store.consumeRateLimit("reseller-order", viewer!.userId, 3600, 60))) {
      return NextResponse.json({ error: "Trop de commandes envoyées. Réessayez plus tard." }, { status: 429, headers: PRIVATE_HEADERS });
    }
    const body = await readJson(request).catch(() => null);
    const result = await placeOrder(channel, viewer, body, deps);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors, issues: result.issues, quote: result.quote }, { status: result.status, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ reference: result.reference }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return serverError(err, "commande-revendeur");
  }
}
