import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { DemoBanner } from "@/components/site/DemoBanner";
import { content } from "@/lib/catalog";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await content.getSettings().catch(() => null);
  return (
    <>
      <DemoBanner />
      <Header />
      <main id="contenu" className="min-h-[60vh]">
        {children}
      </main>
      <Footer settings={settings} />
    </>
  );
}
