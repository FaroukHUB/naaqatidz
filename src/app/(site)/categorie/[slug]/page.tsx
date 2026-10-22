import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { content } from "@/lib/catalog";
import { CategoryListing } from "@/components/site/CategoryListing";

export const revalidate = 60;

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
  const [subcategories, products] = await Promise.all([
    content.listSubcategories(category.slug),
    content.listProducts({ categorySlug: category.slug }),
  ]);
  return (
    <CategoryListing
      category={category}
      subcategories={subcategories}
      current={null}
      products={products}
      otherCategories={categories.filter((c) => c.slug !== category.slug)}
    />
  );
}
