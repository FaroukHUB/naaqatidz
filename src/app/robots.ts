import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Le noindex ne remplace pas l'authentification : ces espaces sont aussi protégés côté serveur.
        disallow: ["/panier", "/commande", "/connexion", "/revendeur", "/admin", "/studio", "/api/", "/auth/"],
      },
    ],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
