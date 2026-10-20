import { NextResponse } from "next/server";
import { computeQuote } from "@/lib/server/orders";
import { clientKey, getOrderDeps, PRIVATE_HEADERS, readJson, serverError } from "@/lib/server/context";

/** Devis particulier : prix publics uniquement, recalculés côté serveur. */
export async function POST(request: Request) {
  try {
    const deps = getOrderDeps();
    if (!(await deps.store.consumeRateLimit("quote", clientKey(request), 600, 300))) {
      return NextResponse.json({ error: "Trop de requêtes. Patientez quelques minutes." }, { status: 429, headers: PRIVATE_HEADERS });
    }
    const body = await readJson(request).catch(() => null);
    const result = await computeQuote("retail", body, deps);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: PRIVATE_HEADERS });
    return NextResponse.json({ quote: result.quote }, { headers: PRIVATE_HEADERS });
  } catch (err) {
    return serverError(err, "devis");
  }
}
