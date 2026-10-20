import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/env";
import { Notice } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Connexion — espace revendeur", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ suite?: string; erreur?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { suite, erreur } = await searchParams;
  return (
    <div className="container-page max-w-md py-12">
      <h1 className="text-3xl">Espace revendeur</h1>
      <p className="mt-2 text-encre/80">Connexion réservée aux revendeurs dont le compte a été activé par Naaqati, et à l&apos;administration.</p>
      <div className="mt-6 space-y-4">
        {!isSupabaseConfigured && <Notice tone="warning" title="Configuration requise">Supabase n&apos;est pas encore configuré : la connexion est indisponible.</Notice>}
        {erreur === "acces" && <Notice tone="error">Ce compte n&apos;a pas accès à cette page.</Notice>}
        {erreur === "lien" && <Notice tone="error">Ce lien n&apos;est plus valide. Demandez un nouvel email.</Notice>}
        <LoginForm suite={suite} />
        <p className="text-sm"><Link href="/connexion/mot-de-passe-oublie" className="text-titre underline">Mot de passe oublié ?</Link></p>
        <p className="text-sm text-encre/70">Vous souhaitez devenir revendeur ? <Link href="/contact" className="underline">Contactez Naaqati</Link> : votre compte sera créé et validé par l&apos;équipe.</p>
      </div>
    </div>
  );
}
