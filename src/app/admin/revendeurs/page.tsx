import type { Metadata } from "next";
import Link from "next/link";
import { activateReseller, createReseller } from "@/lib/actions/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { listWilayas } from "@/lib/geo/algeria";
import { Flash } from "../Flash";
import { CountryAndAddress } from "./CountryAndAddress";

const wilayas = listWilayas().map((w) => ({ code: w.code, name: w.nameFr }));

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
    .select("id, email, status, company_name, contact_name, phone, validated_country, declared_country, created_at")
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
          <div><label htmlFor="contact_name" className="field-label">Nom et prénom</label><input id="contact_name" name="contact_name" className="field" /></div>
          <div><label htmlFor="company_name" className="field-label">Boutique / société</label><input id="company_name" name="company_name" className="field" /></div>
          <div><label htmlFor="phone" className="field-label">Téléphone / WhatsApp</label><input id="phone" name="phone" type="tel" placeholder="+213 …" className="field" /></div>
          <div>
            <label htmlFor="password" className="field-label">Mot de passe</label>
            <input id="password" name="password" type="text" minLength={8} autoComplete="off" placeholder="Laisser vide = créé automatiquement" className="field" />
          </div>
          <CountryAndAddress wilayas={wilayas} country="DZ" address={{ wilayaCode: "", communeCode: "", city: "", postalCode: "", address: "", notes: "" }} />
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
                    <td>{(() => { const c = r.validated_country ?? r.declared_country; return c ? COUNTRY[c as keyof typeof COUNTRY] ?? c : "—"; })()}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                    <td>
                      <div className="flex flex-wrap items-center gap-3">
                        {r.status === "pending" && (
                          <form action={activateReseller}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="btn-primary btn-small">Activer</button>
                          </form>
                        )}
                        <Link href={`/admin/revendeurs/${r.id}`} className="font-semibold text-titre underline">Gérer</Link>
                      </div>
                    </td>
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
