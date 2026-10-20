import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { content } from "@/lib/catalog";
import { CategoryListing } from "@/components/site/CategoryListing";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string; sous: string }> };

export async function generateStaticParams() {
  const categories = await content.listCategories().catch(() => []);
  const all = await Promise.all(
    categories.map(async (c) => (await content.listSubcategories(c.slug).catch(() => [])).map((s) => ({ slug: c.slug, sous: s.slug }))),
  );
  return all.flat();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sous } = await params;
  const sub = await content.getSubcategory(slug, sous);
  if (!sub) return {};
  return {
    title: sub.seo.title ?? `${sub.title} — ${sub.category.title}`,
    description: sub.seo.description ?? sub.description ?? undefined,
    alternates: { canonical: `/categorie/${slug}/${sub.slug}` },
  };
}

export default async function SubcategoryPage({ params }: Props) {
  const { slug, sous } = await params;
  const [category, current, categories] = await Promise.all([
    content.getCategory(slug),
    content.getSubcategory(slug, sous),
    content.listCategories(),
  ]);
  if (!category || !current) notFound();
  const [subcategories, products] = await Promise.all([
    content.listSubcategories(category.slug),
    content.listProducts({ categorySlug: category.slug, subcategorySlug: current.slug }),
  ]);
  return (
    <CategoryListing
      category={category}
      subcategories={subcategories}
      current={current}
      products={products}
      otherCategories={categories.filter((c) => c.slug !== category.slug)}
    />
  );
}
