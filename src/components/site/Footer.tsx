import Link from "next/link";
import type { SiteSettingsView } from "@/lib/catalog/types";
import { LEGAL_PAGES } from "@/lib/legal-pages";

export function Footer({ settings }: { settings: SiteSettingsView | null }) {
  return (
    <footer className="mt-16 bg-ilaji text-encre-claire">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-xl tracking-[0.2em] text-or">NAAQATI</p>
          <p className="mt-1 text-sm tracking-widest text-encre-claire/80">PRODUITS DU SAHARA</p>
        </div>
        <nav aria-label="Informations">
          <p className="mb-2 font-semibold text-or">Informations</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/a-propos" className="hover:underline">À propos</Link></li>
            <li><Link href="/contact" className="hover:underline">Contact</Link></li>
            {LEGAL_PAGES.map((p) => (
              <li key={p.slug}><Link href={`/informations/${p.slug}`} className="hover:underline">{p.title}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-or">Nous contacter</p>
          {settings?.phone && <p><a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="hover:underline">{settings.phone}</a></p>}
          {settings?.email && <p><a href={`mailto:${settings.email}`} className="hover:underline">{settings.email}</a></p>}
          {!settings?.phone && !settings?.email && <p className="text-encre-claire/70">Coordonnées à compléter.</p>}
          <p className="mt-6">
            <Link href="/revendeur" className="underline-offset-2 hover:underline">Espace revendeur</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
