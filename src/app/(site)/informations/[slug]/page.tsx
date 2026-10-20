import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { content } from "@/lib/catalog";
import { LEGAL_PAGES } from "@/lib/legal-pages";
import { RichText } from "@/components/ui/RichText";

export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const def = LEGAL_PAGES.find((p) => p.slug === slug);
  const page = await content.getLegalPage(slug).catch(() => null);
  return {
    title: page?.seo.title ?? page?.title ?? def?.title,
    description: page?.seo.description ?? undefined,
    alternates: { canonical: `/informations/${slug}` },
    // Une page non rédigée n'est pas indexée.
    robots: page ? undefined : { index: false },
  };
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  const def = LEGAL_PAGES.find((p) => p.slug === slug);
  if (!def) notFound();
  const page = await content.getLegalPage(slug);
  return (
    <div className="container-page py-10">
      <h1 className="text-4xl">{page?.title ?? def.title}</h1>
      {page?.body?.length ? (
        <div className="mt-6"><RichText value={page.body} /></div>
      ) : (
        <p className="mt-6 text-lg">Cette page est en cours de rédaction. Pour toute question, contactez-nous.</p>
      )}
      {page?.updatedAt && <p className="mt-10 text-sm text-encre/60">Mise à jour : {new Date(page.updatedAt).toLocaleDateString("fr-FR")}</p>}
    </div>
  );
}
