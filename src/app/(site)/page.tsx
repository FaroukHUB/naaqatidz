import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { content } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";
import { JsonLd } from "@/components/ui/JsonLd";
import { ProductCard } from "@/components/site/ProductCard";
import { SiteImage } from "@/components/ui/SiteImage";
import { Dunes, SectionTitle, Sparkle } from "@/components/brand/Decor";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const home = await content.getHome().catch(() => null);
  return {
    title: { absolute: home?.seo.title ?? "Naaqati — Produits du Sahara" },
    description: home?.seo.description ?? undefined,
    alternates: { canonical: "/" },
  };
}

/**
 * Textes par défaut, utilisés tant que la page d'accueil n'est pas renseignée dans Sanity.
 * Ils ne reprennent que des informations confirmées par la marque (nom, histoire, activités,
 * implantation, paiement à la livraison en Algérie) : aucun bienfait, avis ou promesse de délai.
 */
const DEFAULTS = {
  heroTitle: "Produits du Sahara",
  heroText: "Savons artisanaux, soins à base de graisse de bosse de chameau et khôl traditionnel, préparés au cœur du Sahara algérien.",
  storyTitle: "« Naaqati », ma chamelle",
  storyText:
    "Le nom Naaqati signifie « ma chamelle » en arabe. Tout a commencé avec le lait de chamelle, un produit noble que nous continuons à proposer. Au fil du temps, notre activité s'est développée autour de savons artisanaux, de soins à base de graisse de bosse de chameau et de notre propre khôl traditionnel.",
};

const UNIVERS = [
  { title: "Lait de chamelle", text: "Là où tout a commencé.", bg: "bg-creme", border: "border-sable", ink: "text-marron" },
  { title: "Savons artisanaux", text: "Fabriqués de manière artisanale.", bg: "bg-rose", border: "border-rose", ink: "text-marron" },
  { title: "Graisse de bosse", text: "Des soins à base de graisse de bosse de chameau.", bg: "bg-sable", border: "border-sable", ink: "text-marron" },
  { title: "Khôl traditionnel", text: "Notre propre khôl, préparé selon la tradition.", bg: "bg-ilaji", border: "border-ilaji", ink: "text-or" },
];

const ENGAGEMENTS = [
  { title: "Au cœur du Sahara", text: "Une marque implantée dans le Sahara algérien, proche de ses ressources." },
  { title: "Artisanal", text: "Des produits fabriqués par Naaqati." },
  { title: "Paiement à la livraison", text: "Pour les commandes livrées en Algérie." },
  { title: "Sans création de compte", text: "Commandez en quelques informations." },
];

export default async function HomePage() {
  const [home, categories, featuredFallback, settings] = await Promise.all([
    content.getHome(),
    content.listCategories(),
    content.listProducts(),
    content.getSettings(),
  ]);
  const featured = home?.featured.length ? home.featured : featuredFallback.slice(0, 4);
  const heroTitle = home?.heroTitle ?? DEFAULTS.heroTitle;
  const heroText = home?.heroText ?? DEFAULTS.heroText;

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

      {/* Héros */}
      <section className="relative overflow-hidden bg-creme">
        <Sparkle className="absolute left-[8%] top-10 text-kraft/60" size={14} />
        <Sparkle className="absolute right-[12%] top-16 text-or" size={18} />
        <Sparkle className="absolute right-[30%] top-8 text-kraft/50" size={10} />
        <div className="container-page relative z-10 grid items-center gap-10 pb-36 pt-12 md:grid-cols-2 md:pb-44 md:pt-20">
          <div className="text-center md:text-left">
            <h1 className="sr-only">Naaqati — {heroTitle}</h1>
            <Image
              src="/brand/naaqati-logo-complet.webp"
              alt=""
              width={1216}
              height={600}
              priority
              unoptimized
              className="mx-auto h-auto w-full max-w-md md:mx-0"
            />
            <p className="tagline mt-8 text-2xl leading-snug sm:text-3xl">{heroTitle}</p>
            <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-encre/80 md:mx-0">{heroText}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/boutique" className="btn-primary px-7">Découvrir la boutique</Link>
              <Link href="/a-propos" className="btn-secondary px-7">Notre histoire</Link>
            </div>
          </div>
          {home?.heroImage ? (
            <div className="overflow-hidden rounded-t-full border-8 border-white/70 shadow-xl">
              <SiteImage image={home.heroImage} sizes="(min-width: 768px) 50vw, 100vw" priority className="aspect-[4/5] h-full w-full object-cover" />
            </div>
          ) : (
            <div className="relative mx-auto hidden aspect-[4/5] w-full max-w-sm items-end justify-center overflow-hidden rounded-t-full bg-gradient-to-b from-sable via-kraft/70 to-symbole md:flex" aria-hidden="true">
              <div className="absolute inset-x-0 top-[18%] mx-auto h-24 w-24 rounded-full bg-or/80 blur-[1px]" />
              <Dunes className="absolute inset-x-0 bottom-0 h-1/2 w-full" tone="dark" />
              <Image src="/brand/naaqati-calligraphie-or.webp" alt="" width={803} height={220} unoptimized className="relative mb-10 w-3/4" />
            </div>
          )}
        </div>
        <Dunes className="absolute inset-x-0 bottom-0 h-28 w-full md:h-40" />
      </section>

      {/* Univers de la marque */}
      <section className="container-page py-16" aria-labelledby="titre-univers">
        <SectionTitle kicker="Nos savoir-faire" title="L'univers Naaqati" id="titre-univers" />
        <ul className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          {UNIVERS.map((u) => (
            <li key={u.title} className={`relative flex min-h-44 flex-col justify-end overflow-hidden rounded-2xl border ${u.border} ${u.bg} p-5`}>
              <Sparkle className={`absolute right-4 top-4 ${u.ink} opacity-70`} size={12} />
              <h3 className={`font-display text-base uppercase tracking-[0.1em] sm:text-lg ${u.ink}`}>{u.title}</h3>
              <p className={`tagline mt-2 text-sm sm:text-base ${u.ink === "text-or" ? "text-encre-claire" : ""}`}>{u.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Catégories réellement publiées */}
      {categories.length > 0 && (
        <section className="container-page pb-16" aria-labelledby="titre-categories">
          <SectionTitle kicker="Boutique" title="Nos catégories" id="titre-categories" />
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categorie/${c.slug}`} className="group block overflow-hidden rounded-2xl border border-sable bg-white transition-shadow hover:shadow-lg">
                  <div className="aspect-[4/3] overflow-hidden bg-creme">
                    <SiteImage image={c.image} sizes="(min-width: 1024px) 25vw, 50vw" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <p className="p-4 text-center font-display text-sm uppercase tracking-[0.12em] text-marron">{c.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sélection */}
      <section className="bg-white py-16" aria-labelledby="titre-selection">
        <div className="container-page">
          <SectionTitle kicker="La boutique" title="Notre sélection" id="titre-selection" />
          {featured.length > 0 ? (
            <>
              <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {featured.map((p) => (
                  <li key={p.id}><ProductCard product={p} /></li>
                ))}
              </ul>
              <div className="mt-10 text-center">
                <Link href="/boutique" className="btn-secondary px-8">Voir toute la boutique</Link>
              </div>
            </>
          ) : (
            <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-sable bg-creme px-6 py-10 text-center">
              <Image src="/brand/naaqati-calligraphie.webp" alt="" width={803} height={220} unoptimized className="mx-auto w-48 opacity-80" />
              <p className="tagline mt-6 text-xl">Notre boutique en ligne se prépare.</p>
              <p className="mt-2 text-encre/70">Les produits seront présentés ici très prochainement.</p>
              <Link href="/contact" className="btn-secondary mt-6">Nous contacter</Link>
            </div>
          )}
        </div>
      </section>

      {/* Histoire */}
      <section className="relative overflow-hidden bg-ilaji py-20 text-encre-claire" aria-labelledby="titre-histoire">
        <Sparkle className="absolute left-[10%] top-12 text-or/70" size={16} />
        <Sparkle className="absolute right-[8%] bottom-16 text-or/50" size={12} />
        <div className="container-page grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <SectionTitle kicker="Notre histoire" title={home?.storyTitle ?? DEFAULTS.storyTitle} id="titre-histoire" align="left" tone="dark" />
            <p className="mt-6 whitespace-pre-line text-lg leading-relaxed">{home?.storyText ?? DEFAULTS.storyText}</p>
            <Link href="/a-propos" className="mt-8 inline-flex min-h-12 items-center rounded-md border border-or px-6 font-semibold text-or transition-colors hover:bg-or hover:text-ilaji">
              Lire notre histoire
            </Link>
          </div>
          <div className="order-1 md:order-2">
            {home?.storyImage ? (
              <SiteImage image={home.storyImage} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full rounded-2xl object-cover" />
            ) : (
              <Image src="/brand/naaqati-logo-complet-or.webp" alt="" width={1216} height={600} unoptimized className="mx-auto w-full max-w-md" />
            )}
          </div>
        </div>
      </section>

      {/* Engagements (faits confirmés uniquement) */}
      <section className="container-page py-16" aria-label="Pourquoi Naaqati">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {ENGAGEMENTS.map((e) => (
            <li key={e.title} className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-creme text-titre">
                <Sparkle size={16} />
              </span>
              <h3 className="mt-4 font-display text-sm uppercase tracking-[0.14em] text-marron">{e.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-encre/70">{e.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Revendeurs */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-sable px-6 py-12 text-center sm:px-12">
          <Dunes className="absolute inset-x-0 bottom-0 h-20 w-full opacity-60" />
          <div className="relative">
            <p className="kicker">Professionnels</p>
            <h2 className="title-display mt-3 text-2xl">Espace revendeur</h2>
            <p className="mx-auto mt-4 max-w-xl text-encre/80">
              {settings?.resellerIntro ?? "Vous revendez nos produits en Algérie ou en France ? Accédez à votre catalogue et à vos commandes avec votre compte validé par Naaqati."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/revendeur" className="btn-primary">Accéder à l&apos;espace revendeur</Link>
              <Link href="/contact" className="btn-secondary bg-white/60">Devenir revendeur</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
