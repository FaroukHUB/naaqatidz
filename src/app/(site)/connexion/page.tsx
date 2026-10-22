import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/env";
import { Notice } from "@/components/ui/Notice";
import { getViewer } from "@/lib/server/viewer";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Connexion — espace revendeur", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ suite?: string; erreur?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { suite, erreur } = await searchParams;
  const viewer = await getViewer().catch(() => null);
  const isAdmin = viewer?.role === "admin" && viewer.status === "active";
  // Arrivée depuis le bouton « Ouvrir le tableau de bord » (Studio) ou un lien /admin.
  const forAdmin = suite?.startsWith("/admin") ?? false;
  return (
    <div className="container-page max-w-md py-12">
      {forAdmin ? (
        <>
          <h1 className="text-3xl">Administration</h1>
          <p className="mt-2 text-encre/80">Connectez-vous avec votre compte administrateur pour ouvrir le tableau de bord (commandes, revendeurs, livraison).</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl">Espace revendeur</h1>
          <p className="mt-2 text-encre/80">Connexion réservée aux revendeurs dont le compte a été activé par Naaqati, et à l&apos;administration.</p>
        </>
      )}
      <div className="mt-6 space-y-4">
        {!isSupabaseConfigured && <Notice tone="warning" title="Configuration requise">Supabase n&apos;est pas encore configuré : la connexion est indisponible.</Notice>}
        {viewer ? (
          // Déjà connecté : on dit clairement avec quel compte, et où il donne accès.
          <Notice tone={erreur === "acces" ? "error" : "info"} title={`Vous êtes connecté avec ${viewer.email ?? "ce compte"}`}>
            <p>
              {isAdmin
                ? "Ce compte est administrateur."
                : erreur === "acces"
                  ? "Ce compte n'est pas administrateur : l'administration n'est pas accessible avec lui."
                  : viewer.status === "active"
                    ? "Ce compte est un compte revendeur."
                    : "Ce compte n'est pas encore activé."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={isAdmin ? "/admin" : "/revendeur"} className="btn-primary btn-small">{isAdmin ? "Ouvrir l'administration" : "Ouvrir l'espace revendeur"}</Link>
              <form action={signOut}><button className="btn-secondary btn-small">Changer de compte</button></form>
            </div>
          </Notice>
        ) : (
          erreur === "acces" && <Notice tone="error">Ce compte n&apos;a pas accès à cette page.</Notice>
        )}
        {erreur === "lien" && <Notice tone="error">Ce lien n&apos;est plus valide. Demandez un nouvel email.</Notice>}
        <LoginForm suite={suite} />
        <p className="text-sm"><Link href="/connexion/mot-de-passe-oublie" className="text-titre underline">Mot de passe oublié ?</Link></p>
        {!forAdmin && <p className="text-sm text-encre/70">Vous souhaitez devenir revendeur ? <Link href="/contact" className="underline">Contactez Naaqati</Link> : votre compte sera créé et validé par l&apos;équipe.</p>}
      </div>
    </div>
  );
}
