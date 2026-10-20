import "server-only";
import { createClient } from "next-sanity";
import { publicEnv } from "@/lib/env";

/**
 * Lecture seule du contenu publié (dataset public : catalogue et pages, aucune donnée privée).
 * Aucun jeton n'est nécessaire ni utilisé.
 */
export const sanityClient = createClient({
  projectId: publicEnv.sanityProjectId || "non-configure",
  dataset: publicEnv.sanityDataset,
  apiVersion: publicEnv.sanityApiVersion,
  useCdn: true,
  perspective: "published",
});

/** Client sans CDN : utilisé pour valider une commande avec les prix publiés les plus récents. */
export const sanityFreshClient = sanityClient.withConfig({ useCdn: false });

export const SANITY_CACHE_TAG = "sanity";
