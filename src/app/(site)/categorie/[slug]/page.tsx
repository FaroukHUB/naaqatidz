import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { content } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHeader } from "@/components/site/PageHeader";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await content.listCategories().catch(() => [])).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await content.getCategory(slug);
  if (!category) return {};
  return {
    title: category.seo.title ?? category.title,
    description: category.seo.description ?? category.description ?? undefined,
    alternates: { canonical: `/categorie/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([content.getCategory(slug), content.listCategories()]);
  if (!category) notFound();
  const products = await content.listProducts({ categorySlug: category.slug });

  return (
    <>
    <PageHeader kicker="Boutique" title={category.title} intro={category.description} />
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Boutique", href: "/boutique" }, { label: category.title }]} />
      {products.length === 0 ? (
        <p className="mt-8">Aucun produit dans cette catégorie pour le moment.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}><ProductCard product={p} headingLevel="h2" /></li>
          ))}
        </ul>
      )}
      {categories.length > 1 && (
        <nav aria-label="Autres catégories" className="mt-12">
          <h2 className="title-display mb-4 text-xl">Autres catégories</h2>
          <ul className="flex flex-wrap gap-2">
            {categories.filter((c) => c.slug !== category.slug).map((c) => (
              <li key={c.id}>
                <Link href={`/categorie/${c.slug}`} className="inline-block rounded-full border border-kraft px-4 py-2 text-sm font-semibold text-marron hover:bg-creme">{c.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
    </>
  );
}
