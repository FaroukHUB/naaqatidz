import Image from "next/image";
import Link from "next/link";
import type { SiteSettingsView } from "@/lib/catalog/types";
import { LEGAL_PAGES } from "@/lib/legal-pages";

export function Footer({ settings }: { settings: SiteSettingsView | null }) {
  const socials = [
    { href: settings?.instagram, label: "Instagram" },
    { href: settings?.facebook, label: "Facebook" },
    { href: settings?.tiktok, label: "TikTok" },
  ].filter((s): s is { href: string; label: string } => Boolean(s.href));
  return (
    <footer className="mt-20 text-encre-claire">
      <svg aria-hidden="true" className="block h-14 w-full md:h-20" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0 70 C 200 20 380 30 560 66 C 760 104 930 40 1110 44 C 1260 48 1360 76 1440 70 L1440 120 L0 120 Z" fill="#C09064" opacity="0.45" />
        <path d="M0 96 C 240 56 470 70 700 92 C 930 114 1170 70 1440 86 L1440 120 L0 120 Z" fill="#4D3022" />
      </svg>
      <div className="bg-ilaji">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Image src="/brand/naaqati-logo-complet-or.webp" alt="Naaqati — Produits du Sahara" width={1216} height={600} unoptimized className="w-48" />
          <p className="tagline mt-4 text-encre-claire/80">Au cœur du Sahara algérien.</p>
        </div>
        <nav aria-label="Boutique">
          <p className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-or">Boutique</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/boutique" className="hover:text-or">Tous les produits</Link></li>
            <li><Link href="/panier" className="hover:text-or">Panier</Link></li>
            <li><Link href="/a-propos" className="hover:text-or">Notre histoire</Link></li>
            <li><Link href="/revendeur" className="hover:text-or">Espace revendeur</Link></li>
          </ul>
        </nav>
        <nav aria-label="Informations">
          <p className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-or">Informations</p>
          <ul className="space-y-2 text-sm">
            {LEGAL_PAGES.map((p) => (
              <li key={p.slug}><Link href={`/informations/${p.slug}`} className="hover:text-or">{p.title}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="text-sm">
          <p className="mb-3 font-display text-sm uppercase tracking-[0.15em] text-or">Contact</p>
          {settings?.phone && <p><a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="hover:text-or">{settings.phone}</a></p>}
          {settings?.email && <p className="mt-1"><a href={`mailto:${settings.email}`} className="hover:text-or">{settings.email}</a></p>}
          {!settings?.phone && !settings?.email && <p><Link href="/contact" className="hover:text-or">Nous écrire</Link></p>}
          {socials.length > 0 && (
            <ul className="mt-4 flex gap-4">
              {socials.map((s) => (
                <li key={s.label}><a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-or">{s.label}</a></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-center text-xs tracking-[0.2em] text-encre-claire/60">© {new Date().getFullYear()} NAAQATI — PRODUITS DU SAHARA</p>
      </div>
      </div>
    </footer>
  );
}
