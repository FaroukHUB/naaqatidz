import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/viewer";
import { signOut } from "@/lib/actions/auth";
import { Notice } from "@/components/ui/Notice";
import { ResellerCartTab } from "@/components/cart/ResellerCartBadge";

export const metadata: Metadata = { title: "Espace revendeur", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?suite=/revendeur");

  const nav = (
    <nav aria-label="Espace revendeur" className="flex flex-wrap items-center gap-2 border-b border-sable pb-3 text-sm">
      <Link href="/revendeur" className="rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme">Catalogue</Link>
      <ResellerCartTab userId={viewer.userId} className="rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme" />
      <Link href="/revendeur/commandes" className="rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme">Mes commandes</Link>
      <Link href="/revendeur/compte" className="rounded-md px-3 py-2 font-semibold text-marron hover:bg-creme">Mon compte</Link>
      <form action={signOut} className="ml-auto"><button className="rounded-md px-3 py-2 text-marron underline">Se déconnecter</button></form>
    </nav>
  );

  // Un administrateur qui arrive ici est envoyé directement dans l'administration.
  if (viewer.role === "admin" && viewer.status === "active") redirect("/admin");

  if (viewer.status !== "active" || !viewer.pricingProfile) {
    return (
      <div className="container-page max-w-2xl py-8">
        {nav}
        <div className="mt-6">
          <Notice tone="warning" title={viewer.status === "suspended" ? "Compte suspendu" : "Compte pas encore activé"}>
            <p>Vous êtes connecté avec <strong>{viewer.email}</strong>.</p>
            <p className="mt-1">
              {viewer.status === "suspended"
                ? "Ce compte est suspendu. Contactez Naaqati pour plus d'informations."
                : "Ce compte n'a pas encore été activé par Naaqati : les tarifs et la commande ne sont pas disponibles."}
            </p>
            <form action={signOut} className="mt-3"><button className="btn-secondary btn-small">Se connecter avec un autre compte</button></form>
          </Notice>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <p className="mb-2 text-sm text-encre/70">
        {viewer.companyName ?? viewer.contactName ?? viewer.email} · Profil : {viewer.pricingProfile === "reseller_fr" ? "revendeur résidant en France" : "revendeur résidant en Algérie"}
      </p>
      {nav}
      <div className="mt-6">{children}</div>
    </div>
  );
}
