import { defineQuery } from "next-sanity";

const IMAGE = `{ "url": asset->url, alt, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, "lqip": asset->metadata.lqip }`;
const SEO = `"seo": { "title": seo.title, "description": seo.description }`;
const VISIBLE_PRODUCT = `_type == "product" && archived != true && defined(slug.current) && category->hidden != true`;

const SKUS = `"skus": select(
  hasVariants == true => variants[defined(sku)]{ sku, label, priceDzd, netContent, saleable, shippingWeightG },
  defined(sku) => [{ "sku": sku, "label": null, "priceDzd": priceDzd, "netContent": netContent, "saleable": saleable, "shippingWeightG": shippingWeightG }],
  []
)`;

const PRODUCT_SUMMARY = `{
  "id": _id, "slug": slug.current, title, shortDescription, salesMode,
  "image": images[0]${IMAGE},
  "category": category->{ "slug": slug.current, title },
  ${SKUS}
}`;

export const categoriesQuery = defineQuery(`*[_type == "category" && hidden != true && defined(slug.current)] | order(sortOrder asc, title asc){
  "id": _id, "slug": slug.current, title, description, "image": image${IMAGE}, ${SEO}
}`);

export const categoryBySlugQuery = defineQuery(`*[_type == "category" && hidden != true && slug.current == $slug][0]{
  "id": _id, "slug": slug.current, title, description, "image": image${IMAGE}, ${SEO}
}`);

export const productsQuery = defineQuery(`*[${VISIBLE_PRODUCT} && (!defined($categorySlug) || category->slug.current == $categorySlug)]
  | order(category->sortOrder asc, sortOrder asc, title asc) ${PRODUCT_SUMMARY}`);

export const productBySlugQuery = defineQuery(`*[${VISIBLE_PRODUCT} && slug.current == $slug][0]{
  "id": _id, "slug": slug.current, title, shortDescription, salesMode, presentationNote, hasVariants,
  "image": images[0]${IMAGE},
  "images": images[]${IMAGE},
  "category": category->{ "slug": slug.current, title },
  description, ingredients, usage, ${SEO}, "updatedAt": _updatedAt,
  ${SKUS}
}`);

export const homeQuery = defineQuery(`*[_type == "homePage" && _id == "homePage"][0]{
  heroTitle, heroText, "heroImage": heroImage${IMAGE}, storyTitle, storyText, "storyImage": storyImage${IMAGE}, ${SEO},
  "featured": featuredProducts[]->[${VISIBLE_PRODUCT}]${PRODUCT_SUMMARY}
}`);

export const aboutQuery = defineQuery(`*[_type == "aboutPage" && _id == "aboutPage"][0]{
  title, body, "image": image${IMAGE}, ${SEO}, "updatedAt": _updatedAt
}`);

export const legalPageQuery = defineQuery(`*[_type == "legalPage" && slug == $slug] | order(_updatedAt desc)[0]{
  title, body, "image": null, ${SEO}, "updatedAt": _updatedAt
}`);

export const settingsQuery = defineQuery(`*[_type == "siteSettings" && _id == "siteSettings"][0]{
  phone, email, whatsapp, address, openingHours, instagram, facebook, tiktok, contactIntro, resellerIntro,
  "defaultSeo": { "title": defaultSeo.title, "description": defaultSeo.description }
}`);

/** Tous les SKU publiés (y compris archivés / non vendables) : nécessaire pour valider et administrer. */
export const allSkusQuery = defineQuery(`*[_type == "product" && defined(slug.current)]{
  "id": _id, "slug": slug.current, title, archived, salesMode, "image": images[0]${IMAGE}, ${SKUS}
}`);

export const skusByCodeQuery = defineQuery(`*[_type == "product" && (sku in $skus || count(variants[sku in $skus]) > 0)]{
  "id": _id, "slug": slug.current, title, archived, salesMode, "image": images[0]${IMAGE}, ${SKUS}
}`);

export const sitemapQuery = defineQuery(`{
  "categories": *[_type == "category" && hidden != true && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt },
  "products": *[${VISIBLE_PRODUCT}]{ "slug": slug.current, "updatedAt": _updatedAt },
  "legal": *[_type == "legalPage" && defined(slug)]{ slug, "updatedAt": _updatedAt },
  "about": *[_type == "aboutPage" && _id == "aboutPage"][0]._updatedAt
}`);
