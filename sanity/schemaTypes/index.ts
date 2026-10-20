import { category } from "./category";
import { aboutPage, homePage, legalPage, siteSettings } from "./pages";
import { product } from "./product";
import { imageWithAlt, richText, seo } from "./shared";
import { variant } from "./variant";

export const schemaTypes = [seo, imageWithAlt, richText, variant, product, category, homePage, aboutPage, legalPage, siteSettings];

/** Documents uniques (un seul exemplaire). */
export const SINGLETONS = ["homePage", "aboutPage", "siteSettings"] as const;
