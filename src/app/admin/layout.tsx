import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/viewer";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: { default: "Administration", template: "%s | Administration Naaqati" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Accueil" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/revendeurs", label: "Revendeurs" },
  { href: "/admin/tarifs-france", label: "Tarifs France" },
  { href: "/admin/livraison", label: "Livraison" },
  { href: "/admin/parametres", label: "Paramètres" },
  { href: "/admin/administrateurs", label: "Administrateurs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-screen bg-papier">
      <header className="border-b border-sable bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <Link href="/admin" className="mr-2 flex items-center gap-2">
            <Image src="/brand/naaqati-logo.webp" alt="Naaqati" width={357} height={160} unoptimized className="h-9 w-auto" />
            <span className="text-sm font-semibold text-marron">Administration</span>
          </Link>
          <nav aria-label="Administration" className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto whitespace-nowrap px-4 pb-1 text-sm md:order-none md:mx-0 md:w-auto md:flex-1 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme">{n.label}</Link>
            ))}
            <Link href="/studio" prefetch={false} className="rounded-md bg-creme px-3 py-2 font-semibold text-symbole hover:bg-sable">Catalogue &amp; contenus (Sanity Studio) ↗</Link>
          </nav>
          <span className="ml-auto hidden text-xs text-encre/60 sm:inline">{viewer.email}</span>
          <form action={signOut}><button className="rounded-md px-3 py-2 text-sm underline">Déconnexion</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
