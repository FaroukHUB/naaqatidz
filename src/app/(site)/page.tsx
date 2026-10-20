import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { content } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";
import { JsonLd } from "@/components/ui/JsonLd";
import { ProductCard } from "@/components/site/ProductCard";
import { SiteImage } from "@/components/ui/SiteImage";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const home = await content.getHome().catch(() => null);
  return {
    title: { absolute: home?.seo.title ?? "Naaqati — Produits du Sahara" },
    description: home?.seo.description ?? undefined,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [home, categories, settings] = await Promise.all([content.getHome(), content.listCategories(), content.getSettings()]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Naaqati",
          url: publicEnv.siteUrl,
          logo: `${publicEnv.siteUrl}/brand/naaqati-logo-complet.png`,
          ...(settings?.email ? { email: settings.email } : {}),
          ...(settings?.phone ? { telephone: settings.phone } : {}),
          sameAs: [settings?.instagram, settings?.facebook, settings?.tiktok].filter(Boolean),
        }}
      />

      <section className="bg-creme">
        <div className="container-page grid items-center gap-8 py-10 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="sr-only">Naaqati — Produits du Sahara</h1>
            <Image src="/brand/naaqati-logo-complet.webp" alt="" width={1216} height={600} priority unoptimized className="mb-6 h-auto w-full max-w-sm" />
            {home?.heroTitle && <p className="font-serif text-3xl leading-tight text-marron sm:text-4xl">{home.heroTitle}</p>}
            {home?.heroText && <p className="mt-4 max-w-prose text-lg leading-relaxed">{home.heroText}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/boutique" className="btn-primary">Découvrir la boutique</Link>
              <Link href="/a-propos" className="btn-secondary">Notre histoire</Link>
            </div>
          </div>
          {home?.heroImage && (
            <div className="overflow-hidden rounded-lg">
              <SiteImage image={home.heroImage} sizes="(min-width: 768px) 50vw, 100vw" priority className="h-auto w-full object-cover" />
            </div>
          )}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="container-page py-10" aria-labelledby="titre-categories">
          <h2 id="titre-categories" className="mb-5 text-3xl">Nos catégories</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categorie/${c.slug}`} className="card flex h-full flex-col overflow-hidden hover:shadow-md">
                  {c.image && <SiteImage image={c.image} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-[4/3] w-full object-cover" />}
                  <span className="p-3 font-serif text-lg text-marron">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {home && home.featured.length > 0 && (
        <section className="container-page py-6" aria-labelledby="titre-selection">
          <h2 id="titre-selection" className="mb-5 text-3xl">Notre sélection</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {home.featured.map((p) => (
              <li key={p.id}><ProductCard product={p} /></li>
            ))}
          </ul>
        </section>
      )}

      {(home?.storyTitle || home?.storyText) && (
        <section className="mt-10 bg-sable/50" aria-labelledby="titre-histoire">
          <div className="container-page grid items-center gap-8 py-12 md:grid-cols-2">
            {home.storyImage && <SiteImage image={home.storyImage} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full rounded-lg object-cover" />}
            <div>
              <h2 id="titre-histoire" className="text-3xl">{home.storyTitle ?? "Notre histoire"}</h2>
              {home.storyText && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed">{home.storyText}</p>}
              <Link href="/a-propos" className="mt-6 inline-block font-semibold text-titre underline underline-offset-4">Lire notre histoire</Link>
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-10 text-center">
        <p className="text-sm text-marron/80">
          Vous êtes revendeur ? <Link href="/revendeur" className="font-semibold text-titre underline underline-offset-4">Accéder à l&apos;espace revendeur</Link>
        </p>
      </section>
    </>
  );
}
