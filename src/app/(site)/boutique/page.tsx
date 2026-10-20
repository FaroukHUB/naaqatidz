import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { content } from "@/lib/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHeader } from "@/components/site/PageHeader";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Boutique",
  description: "Tous les produits Naaqati : savons artisanaux, soins et khôl traditionnel, préparés au cœur du Sahara algérien.",
  alternates: { canonical: "/boutique" },
};

export default async function ShopPage() {
  const [categories, products] = await Promise.all([content.listCategories(), content.listProducts()]);
  return (
    <>
      <PageHeader kicker="Produits du Sahara" title="La boutique" intro="Savons artisanaux, soins et khôl traditionnel." />
      <div className="container-page py-10">
        {categories.length > 0 && (
          <nav aria-label="Catégories" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            <span className="shrink-0 rounded-full bg-symbole px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white">Tout</span>
            {categories.map((c) => (
              <Link key={c.id} href={`/categorie/${c.slug}`} className="shrink-0 rounded-full border border-kraft px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-marron hover:bg-creme">
                {c.title}
              </Link>
            ))}
          </nav>
        )}
        {products.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-sable bg-white px-6 py-12 text-center">
            <Image src="/brand/naaqati-calligraphie.webp" alt="" width={803} height={220} unoptimized className="mx-auto w-52 opacity-80" />
            <p className="tagline mt-6 text-2xl">La boutique se prépare.</p>
            <p className="mt-3 text-encre/70">Nos produits seront présentés ici très prochainement.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/a-propos" className="btn-secondary">Découvrir notre histoire</Link>
              <Link href="/contact" className="btn-primary">Nous contacter</Link>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}><ProductCard product={p} headingLevel="h2" /></li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
