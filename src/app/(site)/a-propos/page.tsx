import type { Metadata } from "next";
import { content } from "@/lib/catalog";
import { RichText } from "@/components/ui/RichText";
import { SiteImage } from "@/components/ui/SiteImage";
import { PageHeader } from "@/components/site/PageHeader";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const about = await content.getAbout().catch(() => null);
  return {
    title: about?.seo.title ?? about?.title ?? "À propos",
    description: about?.seo.description ?? "L'histoire de Naaqati, « ma chamelle » en arabe : du lait de chamelle aux savons artisanaux, au cœur du Sahara algérien.",
    alternates: { canonical: "/a-propos" },
    robots: about ? undefined : { index: false },
  };
}

export default async function AboutPage() {
  const about = await content.getAbout();
  return (
    <>
    <PageHeader kicker="Notre histoire" title={about?.title ?? "À propos de Naaqati"} intro="« Naaqati » signifie « ma chamelle » en arabe." />
    <div className="container-page py-12">
      {about ? (
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[3fr_2fr]">
          <RichText value={about.body} />
          {about.image && <SiteImage image={about.image} sizes="(min-width: 768px) 33vw, 100vw" className="h-auto w-full rounded-lg" />}
        </div>
      ) : (
        <p className="tagline text-center text-xl">Cette page est en cours de rédaction.</p>
      )}
    </div>
    </>
  );
}
