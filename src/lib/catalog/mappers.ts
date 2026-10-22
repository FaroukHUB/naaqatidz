import { toMinor } from "@/lib/domain/money";
import type { CatalogSku } from "@/lib/domain/types";
import type { ImageView, ProductSummary, ProductView, SalesMode, SkuView } from "./types";

export interface RawImage {
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  lqip?: string | null;
}

export interface RawSku {
  sku: string;
  label: string | null;
  scent?: string | null;
  priceDzd: number | null;
  netContent: string | null;
  saleable: boolean | null;
  shippingWeightG: number | null;
}

export interface RawProduct {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string | null;
  salesMode?: string | null;
  archived?: boolean | null;
  image?: RawImage | null;
  category?: { slug: string; title: string } | null;
  subcategory?: { slug: string; title: string } | null;
  skus?: RawSku[] | null;
}

export function mapImage(raw: RawImage | null | undefined): ImageView | null {
  if (!raw?.url || !raw.width || !raw.height) return null;
  return { url: raw.url, alt: raw.alt ?? "", width: raw.width, height: raw.height, lqip: raw.lqip ?? null };
}

export function salesModeOf(raw: { salesMode?: string | null }): SalesMode {
  return raw.salesMode === "presentation" ? "presentation" : "online";
}

function priceMinor(priceDzd: number | null | undefined): number | null {
  return typeof priceDzd === "number" && Number.isInteger(priceDzd) && priceDzd > 0 ? toMinor(priceDzd, "DZD") : null;
}

function weight(w: number | null | undefined): number | null {
  return typeof w === "number" && Number.isInteger(w) && w > 0 ? w : null;
}

/** Une référence est vendable si : produit non archivé, mode « vente en ligne », vente activée et prix renseigné. */
function isSaleable(product: RawProduct, sku: RawSku): boolean {
  return product.archived !== true && salesModeOf(product) === "online" && sku.saleable !== false && priceMinor(sku.priceDzd) !== null;
}

/** Libellé complet d'une variante : contenance et, le cas échéant, senteur (ex. « 25 g — Monoï »). */
export function variantLabel(s: Pick<RawSku, "label" | "scent">): string | null {
  return [s.label, s.scent].filter(Boolean).join(" — ") || null;
}

export function mapSkuViews(product: RawProduct): SkuView[] {
  return (product.skus ?? []).map((s) => ({
    sku: s.sku,
    label: s.label,
    scent: s.scent ?? null,
    priceDzdMinor: priceMinor(s.priceDzd),
    netContent: s.netContent,
    saleable: isSaleable(product, s),
  }));
}

export function mapSummary(raw: RawProduct): ProductSummary {
  const skus = mapSkuViews(raw);
  const prices = skus.filter((s) => s.saleable && s.priceDzdMinor !== null).map((s) => s.priceDzdMinor as number);
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    shortDescription: raw.shortDescription ?? null,
    image: mapImage(raw.image),
    category: raw.category ?? null,
    subcategory: raw.subcategory?.slug ? raw.subcategory : null,
    salesMode: salesModeOf(raw),
    fromPriceDzdMinor: prices.length ? Math.min(...prices) : null,
    hasSaleableSku: skus.some((s) => s.saleable),
  };
}

export function mapProductView(
  raw: RawProduct & {
    images?: RawImage[] | null;
    description?: ProductView["description"];
    ingredients?: string | null;
    usage?: string | null;
    presentationNote?: string | null;
    hasVariants?: boolean | null;
    seo?: { title?: string | null; description?: string | null } | null;
    updatedAt?: string | null;
  },
): ProductView {
  return {
    ...mapSummary(raw),
    description: raw.description ?? null,
    ingredients: raw.ingredients ?? null,
    usage: raw.usage ?? null,
    presentationNote: raw.presentationNote ?? null,
    images: (raw.images ?? []).map(mapImage).filter((i): i is ImageView => i !== null),
    hasVariants: raw.hasVariants === true,
    skus: mapSkuViews(raw),
    seo: { title: raw.seo?.title ?? null, description: raw.seo?.description ?? null },
    updatedAt: raw.updatedAt ?? null,
  };
}

export function mapCatalogSkus(products: readonly RawProduct[]): CatalogSku[] {
  return products.flatMap((p) =>
    (p.skus ?? []).map((s) => ({
      sku: s.sku,
      productId: p.id,
      productSlug: p.slug,
      productName: p.title,
      variantLabel: variantLabel(s),
      priceDzdMinor: priceMinor(s.priceDzd),
      shippingWeightG: weight(s.shippingWeightG),
      saleable: isSaleable(p, s),
      imageUrl: p.image?.url ?? null,
    })),
  );
}
