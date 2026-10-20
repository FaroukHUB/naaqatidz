import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/components/cart/CartLink";
import { Sparkle } from "@/components/brand/Decor";

const NAV = [
  { href: "/boutique", label: "Boutique" },
  { href: "/a-propos", label: "Notre histoire" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 bg-papier/95 shadow-[0_1px_0_0_var(--color-sable)] backdrop-blur">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <div className="bg-ilaji text-encre-claire">
        <p className="container-page flex items-center justify-center gap-2 py-1.5 text-center text-[11px] uppercase tracking-[0.25em]">
          <Sparkle size={8} className="text-or" /> Paiement à la livraison en Algérie <Sparkle size={8} className="text-or" />
        </p>
      </div>
      <div className="container-page flex h-16 items-center justify-between gap-2 md:h-20">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Naaqati — accueil">
          <Image src="/brand/naaqati-logo.webp" alt="Naaqati" width={357} height={160} priority unoptimized className="h-11 w-auto md:h-14" />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-2 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-4 py-2 font-display text-sm uppercase tracking-[0.14em] text-marron transition-colors hover:text-titre">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/revendeur" className="hidden rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-encre/60 hover:text-titre lg:inline-flex">
            Revendeurs
          </Link>
          <CartLink />
          <details className="relative md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 font-semibold text-marron hover:bg-creme [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Menu</span>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <nav aria-label="Navigation mobile" className="absolute right-0 mt-2 w-64 rounded-xl border border-sable bg-white p-2 shadow-xl">
              {[{ href: "/", label: "Accueil" }, ...NAV, { href: "/revendeur", label: "Espace revendeur" }].map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-md px-4 py-3 font-display text-sm uppercase tracking-[0.12em] text-marron hover:bg-creme">
                  {n.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
