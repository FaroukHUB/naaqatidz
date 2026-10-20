import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/components/cart/CartLink";

const NAV = [
  { href: "/boutique", label: "Boutique" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-sable bg-papier/95 backdrop-blur">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-2">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Naaqati — accueil">
          <Image src="/brand/naaqati-logo.webp" alt="Naaqati" width={357} height={160} priority unoptimized className="h-11 w-auto" />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <CartLink />
          <details className="relative md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 font-semibold text-marron hover:bg-creme [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav aria-label="Navigation mobile" className="absolute right-0 mt-2 w-56 rounded-lg border border-sable bg-white p-2 shadow-lg">
              {[{ href: "/", label: "Accueil" }, ...NAV, { href: "/revendeur", label: "Espace revendeur" }].map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-md px-3 py-3 text-marron hover:bg-creme">
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
