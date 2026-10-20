import { NextResponse } from "next/server";
import { listCommunes } from "@/lib/geo/algeria";

/** Communes d'une wilaya (référentiel public). */
export async function GET(request: Request) {
  const wilaya = new URL(request.url).searchParams.get("wilaya") ?? "";
  if (!/^\d{2}$/.test(wilaya)) return NextResponse.json({ error: "Wilaya invalide." }, { status: 400 });
  const communes = listCommunes(wilaya).map((c) => ({ code: c.code, name: c.nameFr }));
  return NextResponse.json({ communes }, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
}
