import type { SanityClient, ValidationContext } from "sanity";

export const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Vérifie qu'un SKU n'est utilisé qu'une seule fois dans tout le catalogue (produits et variantes). */
export async function skuIsUnique(sku: string | undefined, context: ValidationContext): Promise<true | string> {
  if (!sku) return true;
  if (!SKU_PATTERN.test(sku)) {
    return "Le SKU ne doit contenir que des lettres, chiffres, points, tirets ou soulignés (sans espace).";
  }
  const client: SanityClient = context.getClient({ apiVersion: "2026-10-01" });
  const id = (context.document?._id ?? "").replace(/^drafts\./, "");
  const count = await client.fetch<number>(
    `count(*[_type == "product" && !(_id in [$id, $draftId]) && (sku == $sku || $sku in variants[].sku)])`,
    { sku, id, draftId: `drafts.${id}` },
  );
  if (count > 0) return "Ce SKU est déjà utilisé par une autre référence.";
  const parent = context.document as { sku?: string; variants?: { sku?: string }[] } | undefined;
  const occurrences = [parent?.sku, ...(parent?.variants ?? []).map((v) => v.sku)].filter((s) => s === sku).length;
  if (occurrences > 1) return "Ce SKU est utilisé deux fois dans ce produit.";
  return true;
}
