import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/server/orders";
import { clientKey, getOrderDeps, PRIVATE_HEADERS, readJson, serverError } from "@/lib/server/context";
import { CONFIRMATION_COOKIE } from "@/lib/server/confirmation";

/** Commande particulière, sans compte. */
export async function POST(request: Request) {
  try {
    const deps = getOrderDeps();
    if (!(await deps.store.consumeRateLimit("order", clientKey(request), 3600, 15))) {
      return NextResponse.json({ error: "Trop de commandes envoyées depuis cette connexion. Réessayez plus tard ou contactez-nous." }, { status: 429, headers: PRIVATE_HEADERS });
    }
    const body = await readJson(request).catch(() => null);
    const result = await placeOrder("retail", null, body, deps);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors, issues: result.issues, quote: result.quote }, { status: result.status, headers: PRIVATE_HEADERS });
    }
    const response = NextResponse.json({ reference: result.reference }, { headers: PRIVATE_HEADERS });
    if (result.confirmationToken) {
      response.cookies.set(CONFIRMATION_COOKIE, `${result.reference}.${result.confirmationToken}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/commande/confirmation",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (err) {
    return serverError(err, "commande");
  }
}
