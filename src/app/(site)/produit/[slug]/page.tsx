import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { content } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";
import { toMajor } from "@/lib/domain/money";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { RichText } from "@/components/ui/RichText";
import { SiteImage } from "@/components/ui/SiteImage";
import { ProductCard } from "@/components/site/ProductCard";
import { AddToCart } from "./AddToCart";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await content.listProducts().catch(() => [])).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await content.getProduct(slug);
  if (!product) return {};
  return {
    title: product.seo.title ?? product.title,
    description: product.seo.description ?? product.shortDescription ?? undefined,
    alternates: { canonical: `/produit/${product.slug}` },
    openGraph: product.image ? { images: [{ url: `${product.image.url}?w=1200&auto=format`, alt: product.image.alt }] } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await content.getProduct(slug);
  if (!product) notFound();
  const related = product.category
    ? (await content.listProducts({ categorySlug: product.category.slug })).filter((p) => p.id !== product.id).slice(0, 4)
    : [];

  const saleableSkus = product.skus.filter((s) => s.saleable && s.priceDzdMinor !== null);
  const url = `${publicEnv.siteUrl}/produit/${product.slug}`;

  return (
    <div className="container-page py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          url,
          ...(product.shortDescription ? { description: product.shortDescription } : {}),
          ...(product.images.length ? { image: product.images.map((i) => i.url) } : {}),
          brand: { "@type": "Brand", name: "Naaqati" },
          ...(product.salesMode === "online" && saleableSkus.length
            ? {
                // Prix publics algériens uniquement.
                offers: saleableSkus.map((s) => ({
                  "@type": "Offer",
                  sku: s.sku,
                  ...(s.label ? { name: s.label } : {}),
                  price: toMajor(s.priceDzdMinor as number, "DZD").toFixed(2),
                  priceCurrency: "DZD",
                  url,
                  areaServed: "DZ",
                })),
              }
            : {}),
        }}
      />
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: "Boutique", href: "/boutique" },
          ...(product.category ? [{ label: product.category.title, href: `/categorie/${product.category.slug}` }] : []),
          ...(product.category && product.subcategory
            ? [{ label: product.subcategory.title, href: `/categorie/${product.category.slug}/${product.subcategory.slug}` }]
            : []),
          { label: product.title },
        ]}
      />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg bg-creme">
            <SiteImage image={product.images[0] ?? null} sizes="(min-width: 768px) 50vw, 100vw" priority className="h-auto w-full object-cover" />
          </div>
          {product.images.length > 1 && (
            <ul className="grid grid-cols-4 gap-2">
              {product.images.slice(1).map((img, i) => (
                <li key={i} className="overflow-hidden rounded-md bg-creme">
                  <SiteImage image={img} sizes="25vw" className="aspect-square h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h1 className="text-3xl leading-tight sm:text-4xl">{product.title}</h1>
          {product.shortDescription && <p className="mt-3 text-lg leading-relaxed">{product.shortDescription}</p>}
          <div className="mt-6">
            {product.salesMode === "presentation" ? (
              <div className="rounded-md border border-kraft/60 bg-creme p-4">
                <p>{product.presentationNote ?? "Ce produit n'est pas commandable en ligne."}</p>
                <Link href="/contact" className="mt-3 inline-block font-semibold text-titre underline underline-offset-4">Nous contacter</Link>
              </div>
            ) : (
              <AddToCart
                product={{ title: product.title, slug: product.slug, imageUrl: product.image?.url ?? null }}
                skus={product.skus}
              />
            )}
          </div>
          <div className="mt-8 space-y-6">
            <RichText value={product.description} />
            {product.ingredients && (
              <section>
                <h2 className="text-2xl">Composition</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{product.ingredients}</p>
              </section>
            )}
            {product.usage && (
              <section>
                <h2 className="text-2xl">Conseils d&apos;utilisation</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed">{product.usage}</p>
              </section>
            )}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="titre-associes">
          <h2 id="titre-associes" className="mb-4 text-2xl">Dans la même catégorie</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.map((p) => (
              <li key={p.id}><ProductCard product={p} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
