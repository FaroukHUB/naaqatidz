import type { Metadata } from "next";
import Link from "next/link";
import { createReseller } from "@/lib/actions/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../Flash";

export const metadata: Metadata = { title: "Revendeurs" };

const STATUS = {
  active: { label: "Actif", className: "bg-[#eaf2e6] text-succes" },
  pending: { label: "À activer", className: "bg-sable/60 text-marron" },
  suspended: { label: "Suspendu", className: "bg-rose/60 text-erreur" },
} as const;

const COUNTRY = { DZ: "Algérie", FR: "France" } as const;

export default async function ResellersPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const flash = await searchParams;
  const supabase = await createSessionClient();
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, email, status, company_name, contact_name, phone, validated_country, created_at")
    .eq("role", "reseller")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Revendeurs</h1>
        <p className="mt-1 text-encre/70">Ajoutez un revendeur : son compte est actif tout de suite. Vous lui envoyez ensuite son email et son mot de passe.</p>
      </div>
      <Flash params={flash} />

      <section className="card max-w-2xl p-5">
        <h2 className="text-xl">Ajouter un revendeur</h2>
        <form action={createReseller} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="email" className="field-label">Email du revendeur *</label>
            <input id="email" name="email" type="email" required autoComplete="off" className="field" />
            <p className="mt-1 text-xs text-encre/70">Il s&apos;en servira pour se connecter.</p>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Pays du revendeur *</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-md border border-sable bg-white p-3 has-[:checked]:border-symbole has-[:checked]:bg-creme">
                <input type="radio" name="country" value="DZ" required defaultChecked />
                <span><strong>Algérie</strong><br /><span className="text-sm text-encre/70">Prix publics en DZD, sans limite de quantité.</span></span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-md border border-sable bg-white p-3 has-[:checked]:border-symbole has-[:checked]:bg-creme">
                <input type="radio" name="country" value="FR" />
                <span><strong>France</strong><br /><span className="text-sm text-encre/70">Tarifs France (menu « Tarifs France »).</span></span>
              </label>
            </div>
          </fieldset>
          <div><label htmlFor="contact_name" className="field-label">Nom et prénom</label><input id="contact_name" name="contact_name" className="field" /></div>
          <div><label htmlFor="company_name" className="field-label">Boutique / société</label><input id="company_name" name="company_name" className="field" /></div>
          <div><label htmlFor="phone" className="field-label">Téléphone / WhatsApp</label><input id="phone" name="phone" type="tel" placeholder="+213 …" className="field" /></div>
          <div>
            <label htmlFor="password" className="field-label">Mot de passe</label>
            <input id="password" name="password" type="text" minLength={8} autoComplete="off" placeholder="Laisser vide = créé automatiquement" className="field" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Créer le compte</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xl">Vos revendeurs ({rows?.length ?? 0})</h2>
        <div className="overflow-x-auto rounded-lg border border-sable bg-white">
          <table className="table-admin">
            <thead><tr><th>Revendeur</th><th>Email</th><th>Pays</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const status = STATUS[r.status as keyof typeof STATUS] ?? STATUS.pending;
                return (
                  <tr key={r.id}>
                    <td>{r.contact_name ?? r.company_name ?? "—"}{r.contact_name && r.company_name && <span className="block text-xs text-encre/70">{r.company_name}</span>}</td>
                    <td>{r.email}</td>
                    <td>{r.validated_country ? COUNTRY[r.validated_country as keyof typeof COUNTRY] : "—"}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                    <td><Link href={`/admin/revendeurs/${r.id}`} className="font-semibold text-titre underline">Gérer</Link></td>
                  </tr>
                );
              })}
              {!rows?.length && <tr><td colSpan={5}>Aucun revendeur pour le moment.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
