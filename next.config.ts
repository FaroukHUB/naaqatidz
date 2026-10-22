import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  // Anciennes adresses de catégories (renommées le 22/10/2026).
  async redirects() {
    const moved: [string, string][] = [
      ["nos-savons", "soin-de-la-peau"],
      ["soins-des-cheveux", "soin-des-cheveux"],
      ["soins-du-corps", "hygiene-et-bien-etre"],
      ["visage-et-beaute", "hygiene-et-bien-etre"],
      ["epicerie", "epicerie-naturelle"],
    ];
    return moved.flatMap(([from, to]) => [
      { source: `/categorie/${from}`, destination: `/categorie/${to}`, permanent: true },
      { source: `/categorie/${from}/:sous`, destination: `/categorie/${to}/:sous`, permanent: true },
    ]);
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Le site ne doit pas être affiché dans un cadre tiers (le Studio Sanity gère ses propres besoins).
      { source: "/((?!studio).*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      {
        source: "/(panier|commande|connexion|revendeur|admin|studio)(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
