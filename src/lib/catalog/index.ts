import "server-only";
import { isDemoCatalog, isSanityConfigured } from "@/lib/env";
import { demoSource } from "./demo-source";
import { sanitySource } from "./sanity-source";
import type { ContentSource } from "./types";

const emptySource: ContentSource = {
  kind: "empty",
  listCategories: async () => [],
  getCategory: async () => null,
  listProducts: async () => [],
  getProduct: async () => null,
  getHome: async () => null,
  getAbout: async () => null,
  getLegalPage: async () => null,
  getSettings: async () => null,
  listAllSkus: async () => [],
  getSkusFresh: async () => new Map(),
  listSitemapEntries: async () => [],
};

/** Sanity si configuré ; démonstration en développement local ; sinon catalogue vide (jamais de données inventées). */
export const content: ContentSource = isSanityConfigured ? sanitySource : isDemoCatalog ? demoSource : emptySource;
