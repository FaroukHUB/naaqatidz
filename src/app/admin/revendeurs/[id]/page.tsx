import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { resetResellerPassword, updateReseller } from "@/lib/actions/admin";
import { publicEnv } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../../Flash";
import { CredentialsCard } from "../CredentialsCard";

export const metadata: Metadata = { title: "Compte revendeur" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> };

export default async function ResellerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const flash = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createSessionClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "reseller").maybeSingle();
  if (!p) notFound();
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", id);
  const temp = (await cookies()).get("nq_mdp_provisoire")?.value;
  const tempPassword = temp?.startsWith(`${id}:`) ? temp.slice(id.length + 1) : null;
  const name = p.contact_name ?? p.company_name ?? p.email;
  const message = tempPassword
    ? [
        `Bonjour${p.contact_name ? ` ${p.contact_name}` : ""},`,
        "",
        "Votre espace revendeur Naaqati est prêt.",
        `Connexion : ${publicEnv.siteUrl}/connexion`,
        `Email : ${p.email}`,
        `Mot de passe : ${tempPassword}`,
        "",
        "Vous pourrez changer votre mot de passe dans « Mon compte ».",
      ].join("\n")
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/revendeurs" className="text-sm underline">← Tous les revendeurs</Link>
      <div>
        <h1 className="text-2xl">{name}</h1>
        <p className="text-sm text-encre/70">{p.email} · {count ?? 0} commande(s)</p>
      </div>
      <Flash params={flash} />
      {message && <CredentialsCard message={message} phone={p.phone} />}

      <form action={updateReseller} className="card grid gap-4 p-5">
        <h2 className="text-xl">Informations du compte</h2>
        <input type="hidden" name="id" value={p.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className="field-label">Accès au site</label>
            <select id="status" name="status" defaultValue={p.status} className="field">
              <option value="active">Actif — peut se connecter et commander</option>
              <option value="suspended">Suspendu — ne peut plus se connecter</option>
              {p.status === "pending" && <option value="pending">À activer</option>}
            </select>
          </div>
          <div>
            <label htmlFor="validated_country" className="field-label">Pays (détermine les prix)</label>
            <select id="validated_country" name="validated_country" defaultValue={p.validated_country ?? "DZ"} className="field">
              <option value="DZ">Algérie — prix publics DZD</option>
              <option value="FR">France — tarifs France</option>
            </select>
          </div>
          <div><label htmlFor="contact_name" className="field-label">Nom et prénom</label><input id="contact_name" name="contact_name" defaultValue={p.contact_name ?? ""} className="field" /></div>
          <div><label htmlFor="company_name" className="field-label">Boutique / société</label><input id="company_name" name="company_name" defaultValue={p.company_name ?? ""} className="field" /></div>
          <div><label htmlFor="phone" className="field-label">Téléphone / WhatsApp</label><input id="phone" name="phone" type="tel" defaultValue={p.phone ?? ""} className="field" /></div>
        </div>
        <div><label htmlFor="admin_notes" className="field-label">Notes internes (visibles par vous seule)</label><textarea id="admin_notes" name="admin_notes" defaultValue={p.admin_notes ?? ""} className="field" rows={3} /></div>
        <div><button className="btn-primary btn-small">Enregistrer</button></div>
      </form>

      <form action={resetResellerPassword} className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <input type="hidden" name="id" value={p.id} />
        <div>
          <h2 className="text-xl">Mot de passe</h2>
          <p className="text-sm text-encre/70">Le revendeur l&apos;a oublié, ou vous n&apos;avez pas pu lui envoyer ? Créez-en un nouveau.</p>
        </div>
        <button className="btn-secondary btn-small">Créer un nouveau mot de passe</button>
      </form>
    </div>
  );
}
