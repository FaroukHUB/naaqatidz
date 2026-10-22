import "server-only";
import { sanityClient, sanityFreshClient, SANITY_CACHE_TAG } from "@/lib/sanity/client";
import * as q from "@/lib/sanity/queries";
import { mapCatalogSkus, mapImage, mapProductView, mapSummary, type RawImage, type RawProduct } from "./mappers";
import type { CategoryView, ContentSource, HomeView, LinkView, RichPageView, SiteSettingsView, SubcategoryView, VideoView } from "./types";

// Contenu relu au plus toutes les 60 s (le webhook Sanity, s'il est configuré, rafraîchit immédiatement).
const cached = { next: { revalidate: 60, tags: [SANITY_CACHE_TAG] } };

async function fetchCached<T>(query: string, params: Record<string, unknown> = {}): Promise<T> {
  return sanityClient.fetch<T>(query, params, cached);
}

type RawCategory = Omit<CategoryView, "image" | "seo"> & { image: RawImage | null; seo: CategoryView["seo"] };
type RawRich = Omit<RichPageView, "image"> & { image: RawImage | null };

type RawVideo = { url?: string | null; mimeType?: string | null } | null;
type RawHome = Omit<HomeView, "heroImage" | "heroPoster" | "heroDesktopImage" | "heroVideo" | "heroButtons" | "storyImage" | "featured"> & {
  heroImage: RawImage | null;
  heroPoster: RawImage | null;
  heroDesktopImage: RawImage | null;
  heroVideoDesktop: RawVideo;
  heroVideoMobile: RawVideo;
  heroButtonLabel: string | null;
  heroButtonLink: string | null;
  heroSecondaryLabel: string | null;
  heroSecondaryLink: string | null;
  storyImage: RawImage | null;
  featured: RawProduct[] | null;
};

function mapVideo(raw: RawVideo): VideoView | null {
  return raw?.url ? { url: raw.url, mimeType: raw.mimeType ?? "video/mp4" } : null;
}

/** Liens saisis dans le Studio : page du site (« /… ») ou adresse https uniquement. */
function mapLink(label: string | null | undefined, href: string | null | undefined): LinkView | null {
  if (!label?.trim() || !href) return null;
  return /^\/(?!\/)/.test(href) || href.startsWith("https://") ? { label: label.trim(), href } : null;
}

function mapCategory(raw: RawCategory | null): CategoryView | null {
  return raw ? { ...raw, description: raw.description ?? null, image: mapImage(raw.image) } : null;
}

function mapRich(raw: RawRich | null): RichPageView | null {
  return raw ? { ...raw, body: raw.body ?? null, image: mapImage(raw.image) } : null;
}

export const sanitySource: ContentSource = {
  kind: "sanity",
  async listCategories() {
    const raw = await fetchCached<RawCategory[]>(q.categoriesQuery);
    return raw.map((c) => mapCategory(c) as CategoryView);
  },
  async getCategory(slug) {
    return mapCategory(await fetchCached<RawCategory | null>(q.categoryBySlugQuery, { slug }));
  },
  async listSubcategories(categorySlug) {
    const raw = await fetchCached<SubcategoryView[]>(q.subcategoriesQuery, { categorySlug });
    return raw.map((c) => ({ ...c, description: c.description ?? null }));
  },
  async getSubcategory(categorySlug, slug) {
    const raw = await fetchCached<SubcategoryView | null>(q.subcategoryQuery, { categorySlug, slug });
    return raw ? { ...raw, description: raw.description ?? null } : null;
  },
  async listProducts(opts) {
    const raw = await fetchCached<RawProduct[]>(q.productsQuery, {
      categorySlug: opts?.categorySlug ?? null,
      subcategorySlug: opts?.subcategorySlug ?? null,
    });
    return raw.map(mapSummary);
  },
  async getProduct(slug) {
    const raw = await fetchCached<Parameters<typeof mapProductView>[0] | null>(q.productBySlugQuery, { slug });
    return raw ? mapProductView(raw) : null;
  },
  async getHome() {
    const raw = await fetchCached<RawHome | null>(q.homeQuery);
    if (!raw) return null;
    const { heroVideoDesktop, heroVideoMobile, heroButtonLabel, heroButtonLink, heroSecondaryLabel, heroSecondaryLink, ...rest } = raw;
    return {
      ...rest,
      heroImage: mapImage(raw.heroImage),
      heroPoster: mapImage(raw.heroPoster),
      heroDesktopImage: mapImage(raw.heroDesktopImage),
      heroVideo: { desktop: mapVideo(heroVideoDesktop), mobile: mapVideo(heroVideoMobile) },
      heroButtons: [
        mapLink(heroButtonLabel ?? "Découvrir la boutique", heroButtonLink ?? "/boutique"),
        mapLink(heroSecondaryLabel, heroSecondaryLink),
      ].filter((l): l is LinkView => l !== null),
      storyImage: mapImage(raw.storyImage),
      featured: (raw.featured ?? []).map(mapSummary),
    };
  },
  async getAbout() {
    return mapRich(await fetchCached<RawRich | null>(q.aboutQuery));
  },
  async getLegalPage(slug) {
    return mapRich(await fetchCached<RawRich | null>(q.legalPageQuery, { slug }));
  },
  async getSettings() {
    return fetchCached<SiteSettingsView | null>(q.settingsQuery);
  },
  async listAllSkus() {
    const raw = await sanityFreshClient.fetch<RawProduct[]>(q.allSkusQuery, {}, { cache: "no-store" });
    return mapCatalogSkus(raw);
  },
  async getSkusFresh(skus) {
    if (skus.length === 0) return new Map();
    const raw = await sanityFreshClient.fetch<RawProduct[]>(q.skusByCodeQuery, { skus: [...skus] }, { cache: "no-store" });
    const wanted = new Set(skus);
    return new Map(mapCatalogSkus(raw).filter((s) => wanted.has(s.sku)).map((s) => [s.sku, s]));
  },
  async listSitemapEntries() {
    const raw = await fetchCached<{
      categories: { slug: string; updatedAt: string }[];
      products: { slug: string; updatedAt: string }[];
      subcategories: { slug: string; category: string; updatedAt: string }[];
      legal: { slug: string; updatedAt: string }[];
      about: string | null;
    }>(q.sitemapQuery);
    return [
      ...raw.categories.map((c) => ({ path: `/categorie/${c.slug}`, updatedAt: c.updatedAt })),
      ...raw.subcategories.map((c) => ({ path: `/categorie/${c.category}/${c.slug}`, updatedAt: c.updatedAt })),
      ...raw.products.map((p) => ({ path: `/produit/${p.slug}`, updatedAt: p.updatedAt })),
      ...raw.legal.map((l) => ({ path: `/informations/${l.slug}`, updatedAt: l.updatedAt })),
      ...(raw.about ? [{ path: "/a-propos", updatedAt: raw.about }] : []),
    ];
  },
};
