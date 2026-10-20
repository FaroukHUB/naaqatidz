import "server-only";
import type { PortableTextBlock } from "next-sanity";
import { ABOUT_PROPOSED_PARAGRAPHS } from "./about-text";
import { mapCatalogSkus, mapProductView, mapSummary, type RawProduct } from "./mappers";
import type { CategoryView, ContentSource } from "./types";

/**
 * DONNÉES DE DÉMONSTRATION — développement local uniquement (Sanity non configuré).
 * Noms, prix et poids sont FICTIFS et ne représentent pas le catalogue réel de Naaqati.
 * Ce module n'est jamais utilisé en production (voir isDemoCatalog dans src/lib/env.ts).
 */

const seo = { title: null, description: null };
const categories: CategoryView[] = [
  { id: "demo-cat-savons", slug: "savons", title: "Savons (démo)", description: "Catégorie de démonstration.", image: null, seo },
  { id: "demo-cat-soins", slug: "soins", title: "Soins (démo)", description: "Catégorie de démonstration.", image: null, seo },
  { id: "demo-cat-lait", slug: "lait", title: "Lait de chamelle (démo)", description: "Catégorie de démonstration.", image: null, seo },
];

type DemoProduct = RawProduct & { hasVariants: boolean; presentationNote?: string | null };
const cat = (slug: string) => {
  const c = categories.find((x) => x.slug === slug)!;
  return { slug: c.slug, title: c.title };
};

const products: DemoProduct[] = [
  {
    id: "demo-p1", slug: "savon-demo-a", title: "Savon démo A", shortDescription: "Produit fictif pour tester le parcours d'achat.",
    salesMode: "online", category: cat("savons"), hasVariants: false,
    skus: [{ sku: "DEMO-SAV-A", label: null, priceDzd: 1000, netContent: "100 g (fictif)", saleable: true, shippingWeightG: 150 }],
  },
  {
    id: "demo-p2", slug: "savon-demo-b", title: "Savon démo B", shortDescription: "Produit fictif avec variantes.",
    salesMode: "online", category: cat("savons"), hasVariants: true,
    skus: [
      { sku: "DEMO-SAV-B-S", label: "Petit format (fictif)", priceDzd: 600, netContent: null, saleable: true, shippingWeightG: 90 },
      { sku: "DEMO-SAV-B-L", label: "Grand format (fictif)", priceDzd: 1500, netContent: null, saleable: true, shippingWeightG: 260 },
    ],
  },
  {
    id: "demo-p3", slug: "soin-demo", title: "Soin démo", shortDescription: "Produit fictif sans poids d'expédition (cas d'erreur de colisage).",
    salesMode: "online", category: cat("soins"), hasVariants: false,
    skus: [{ sku: "DEMO-SOIN", label: null, priceDzd: 2000, netContent: "50 ml (fictif)", saleable: true, shippingWeightG: null }],
  },
  {
    id: "demo-p4", slug: "lait-de-chamelle-demo", title: "Lait de chamelle (démo)", shortDescription: "Présenté sans vente en ligne : conditions de vente et d'expédition non définies.",
    salesMode: "presentation", presentationNote: "Ce produit n'est pas commandable en ligne pour le moment. Contactez-nous pour plus d'informations.",
    category: cat("lait"), hasVariants: false,
    skus: [{ sku: "DEMO-LAIT", label: null, priceDzd: null, netContent: null, saleable: false, shippingWeightG: null }],
  },
];

const aboutBody: PortableTextBlock[] = ABOUT_PROPOSED_PARAGRAPHS.map((text, i) => ({
  _type: "block", _key: `p${i}`, style: "normal", markDefs: [],
  children: [{ _type: "span", _key: `s${i}`, text, marks: [] }],
}));

export const demoSource: ContentSource = {
  kind: "demo",
  async listCategories() { return categories; },
  async getCategory(slug) { return categories.find((c) => c.slug === slug) ?? null; },
  async listProducts(opts) {
    return products.filter((p) => !opts?.categorySlug || p.category?.slug === opts.categorySlug).map(mapSummary);
  },
  async getProduct(slug) {
    const p = products.find((x) => x.slug === slug);
    return p ? mapProductView({ ...p, images: [], description: null, ingredients: null, usage: null, seo }) : null;
  },
  async getHome() {
    return {
      heroTitle: "Produits du Sahara",
      heroText: "Aperçu de démonstration : les textes et photos définitifs seront saisis dans Sanity Studio.",
      heroImage: null, storyTitle: "Notre histoire", storyText: ABOUT_PROPOSED_PARAGRAPHS[2] ?? null, storyImage: null,
      featured: products.slice(0, 3).map(mapSummary), seo,
    };
  },
  async getAbout() {
    return { title: "À propos de Naaqati", body: aboutBody, image: null, seo, updatedAt: null };
  },
  async getLegalPage() { return null; },
  async getSettings() { return null; },
  async listAllSkus() { return mapCatalogSkus(products); },
  async getSkusFresh(skus) {
    const wanted = new Set(skus);
    return new Map(mapCatalogSkus(products).filter((s) => wanted.has(s.sku)).map((s) => [s.sku, s]));
  },
  async listSitemapEntries() { return []; },
};
