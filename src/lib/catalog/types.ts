import type { PortableTextBlock } from "next-sanity";
import type { CatalogSku } from "@/lib/domain/types";

export interface ImageView {
  url: string;
  alt: string;
  width: number;
  height: number;
  lqip?: string | null;
}

export interface SeoView {
  title: string | null;
  description: string | null;
}

export interface CategoryView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image: ImageView | null;
  seo: SeoView;
}

export interface SubcategoryView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: { slug: string; title: string };
  seo: SeoView;
}

export type SalesMode = "online" | "presentation";

export interface SkuView {
  sku: string;
  label: string | null;
  /** Senteur (gamme Al ʿĀtir) ; null pour les produits sans parfum. */
  scent: string | null;
  priceDzdMinor: number | null;
  netContent: string | null;
  saleable: boolean;
}

export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  image: ImageView | null;
  category: { slug: string; title: string } | null;
  subcategory: { slug: string; title: string } | null;
  salesMode: SalesMode;
  /** Prix public le plus bas parmi les références vendables (DZD, unités mineures). */
  fromPriceDzdMinor: number | null;
  hasSaleableSku: boolean;
}

export interface ProductView extends ProductSummary {
  description: PortableTextBlock[] | null;
  ingredients: string | null;
  usage: string | null;
  presentationNote: string | null;
  images: ImageView[];
  hasVariants: boolean;
  skus: SkuView[];
  seo: SeoView;
  updatedAt: string | null;
}

export interface VideoView {
  url: string;
  mimeType: string;
}

export interface LinkView {
  label: string;
  href: string;
}

export interface HomeView {
  heroTitle: string | null;
  heroText: string | null;
  heroImage: ImageView | null;
  heroVideo: { desktop: VideoView | null; mobile: VideoView | null };
  heroPoster: ImageView | null;
  /** Photo affichée à la place de la vidéo sur ordinateur. */
  heroDesktopImage: ImageView | null;
  heroButtons: LinkView[];
  storyTitle: string | null;
  storyText: string | null;
  storyImage: ImageView | null;
  featured: ProductSummary[];
  seo: SeoView;
}

export interface RichPageView {
  title: string;
  body: PortableTextBlock[] | null;
  image: ImageView | null;
  seo: SeoView;
  updatedAt: string | null;
}

export interface ContactLineView {
  label: string;
  phone: string;
  whatsapp: boolean;
}

export interface SiteSettingsView {
  contacts: ContactLineView[];
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  openingHours: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  telegram: string | null;
  contactIntro: string | null;
  resellerIntro: string | null;
  defaultSeo: SeoView;
}

/** Accès au contenu public. Aucune donnée confidentielle ne transite par cette interface. */
export interface ContentSource {
  readonly kind: "sanity" | "demo" | "empty";
  listCategories(): Promise<CategoryView[]>;
  getCategory(slug: string): Promise<CategoryView | null>;
  listSubcategories(categorySlug: string): Promise<SubcategoryView[]>;
  getSubcategory(categorySlug: string, slug: string): Promise<SubcategoryView | null>;
  listProducts(opts?: { categorySlug?: string; subcategorySlug?: string }): Promise<ProductSummary[]>;
  getProduct(slug: string): Promise<ProductView | null>;
  getHome(): Promise<HomeView | null>;
  getAbout(): Promise<RichPageView | null>;
  getLegalPage(slug: string): Promise<RichPageView | null>;
  getSettings(): Promise<SiteSettingsView | null>;
  /** Liste complète des SKU publiés (y compris non vendables), pour l'administration. */
  listAllSkus(): Promise<CatalogSku[]>;
  /** Lecture non mise en cache, utilisée pour valider une commande. */
  getSkusFresh(skus: readonly string[]): Promise<Map<string, CatalogSku>>;
  listSitemapEntries(): Promise<{ path: string; updatedAt: string | null }[]>;
}
