import Link from "next/link";
import type { CategoryView, ProductSummary, SubcategoryView } from "@/lib/catalog/types";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/site/ProductCard";

interface Props {
  category: CategoryView;
  subcategories: SubcategoryView[];
  current: SubcategoryView | null;
  products: ProductSummary[];
  otherCategories: CategoryView[];
}

const chip = "shrink-0 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-colors";
const chipOn = `${chip} bg-symbole text-white`;
const chipOff = `${chip} border border-kraft text-marron hover:bg-creme`;

function Grid({ products, headingLevel }: { products: ProductSummary[]; headingLevel: "h2" | "h3" }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}><ProductCard product={p} headingLevel={headingLevel} /></li>
      ))}
    </ul>
  );
}

/** Page catégorie (toutes les sous-catégories) ou sous-catégorie (filtre actif). Les filtres sont de simples liens. */
export function CategoryListing({ category, subcategories, current, products, otherCategories }: Props) {
  const base = `/categorie/${category.slug}`;
  // Vue « Tout » : produits regroupés par sous-catégorie, dans l'ordre défini dans Sanity.
  const groups = !current && subcategories.length > 0
    ? [
        ...subcategories.map((s) => ({ sub: s as SubcategoryView | null, items: products.filter((p) => p.subcategory?.slug === s.slug) })),
        { sub: null, items: products.filter((p) => !p.subcategory || !subcategories.some((s) => s.slug === p.subcategory?.slug)) },
      ].filter((g) => g.items.length > 0)
    : null;

  return (
    <>
      <PageHeader
        kicker={current ? category.title : "Boutique"}
        title={current ? current.title : category.title}
        intro={current ? current.description : category.description}
      />
      <div className="container-page py-8">
        <Breadcrumbs
          items={[
            { label: "Accueil", href: "/" },
            { label: "Boutique", href: "/boutique" },
            ...(current ? [{ label: category.title, href: base }, { label: current.title }] : [{ label: category.title }]),
          ]}
        />

        {subcategories.length > 0 && (
          <nav aria-label={`Filtrer ${category.title}`} className="mb-8 flex flex-wrap gap-2">
            <Link href={base} className={current ? chipOff : chipOn} aria-current={current ? undefined : "page"}>Tout</Link>
            {subcategories.map((s) => {
              const active = current?.slug === s.slug;
              return (
                <Link key={s.id} href={`${base}/${s.slug}`} className={active ? chipOn : chipOff} aria-current={active ? "page" : undefined}>
                  {s.title}
                </Link>
              );
            })}
          </nav>
        )}

        {products.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-sable bg-white px-6 py-10 text-center">
            <p className="tagline text-xl">Les produits de cette rubrique arrivent bientôt.</p>
            <Link href="/boutique" className="btn-secondary mt-6">Voir toute la boutique</Link>
          </div>
        ) : groups ? (
          <div className="space-y-14">
            {groups.map((g) => (
              <section key={g.sub?.id ?? "autres"} aria-labelledby={`grp-${g.sub?.slug ?? "autres"}`}>
                <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-sable pb-3">
                  <h2 id={`grp-${g.sub?.slug ?? "autres"}`} className="title-display text-lg sm:text-xl">{g.sub?.title ?? "Autres produits"}</h2>
                  {g.sub && (
                    <Link href={`${base}/${g.sub.slug}`} className="shrink-0 text-sm font-semibold text-titre underline-offset-4 hover:underline">
                      Voir tout
                    </Link>
                  )}
                </div>
                <Grid products={g.items} headingLevel="h3" />
              </section>
            ))}
          </div>
        ) : (
          <Grid products={products} headingLevel="h2" />
        )}

        {otherCategories.length > 0 && (
          <nav aria-label="Autres catégories" className="mt-16 text-center">
            <h2 className="title-display mb-5 text-lg">Autres catégories</h2>
            <ul className="flex flex-wrap justify-center gap-2">
              {otherCategories.map((c) => (
                <li key={c.id}><Link href={`/categorie/${c.slug}`} className={chipOff + " inline-block"}>{c.title}</Link></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}
