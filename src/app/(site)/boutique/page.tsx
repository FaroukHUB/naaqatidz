import type { Metadata } from "next";
import Link from "next/link";
import { content } from "@/lib/catalog";
import { ProductCard } from "@/components/site/ProductCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Boutique",
  description: "Tous les produits Naaqati : savons artisanaux, soins et khôl traditionnel, préparés au cœur du Sahara algérien.",
  alternates: { canonical: "/boutique" },
};

export default async function ShopPage() {
  const [categories, products] = await Promise.all([content.listCategories(), content.listProducts()]);
  return (
    <div className="container-page py-8">
      <h1 className="text-4xl">Boutique</h1>
      {categories.length > 0 && (
        <nav aria-label="Catégories" className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <Link key={c.id} href={`/categorie/${c.slug}`} className="shrink-0 rounded-full border border-kraft px-4 py-2 text-sm font-semibold text-marron hover:bg-creme">
              {c.title}
            </Link>
          ))}
        </nav>
      )}
      {products.length === 0 ? (
        <p className="mt-10 text-lg">Le catalogue est en cours de préparation. Revenez bientôt.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}><ProductCard product={p} headingLevel="h2" /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
