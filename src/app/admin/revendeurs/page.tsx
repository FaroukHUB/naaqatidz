import type { Metadata } from "next";
import Link from "next/link";
import { createReseller } from "@/lib/actions/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../Flash";

export const metadata: Metadata = { title: "Revendeurs" };

const STATUS = { pending: "En attente", active: "Actif", suspended: "Suspendu" } as const;

export default async function ResellersPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const flash = await searchParams;
  const supabase = await createSessionClient();
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, email, status, company_name, contact_name, declared_country, validated_country, pricing_profile, created_at")
    .eq("role", "reseller")
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Revendeurs</h1>
      <Flash params={flash} />
      <div className="overflow-x-auto rounded-lg border border-sable bg-white">
        <table className="table-admin">
          <thead><tr><th>Compte</th><th>Société / contact</th><th>Statut</th><th>Pays déclaré</th><th>Pays validé</th><th>Profil tarifaire</th></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/revendeurs/${r.id}`} className="text-titre underline">{r.email}</Link></td>
                <td>{r.company_name ?? "—"}<br /><span className="text-xs">{r.contact_name}</span></td>
                <td>{STATUS[r.status as keyof typeof STATUS]}</td>
                <td>{r.declared_country ?? "—"}</td>
                <td>{r.validated_country ?? "—"}</td>
                <td>{r.pricing_profile === "reseller_fr" ? "France" : r.pricing_profile === "reseller_dz" ? "Algérie" : "—"}</td>
              </tr>
            ))}
            {!rows?.length && <tr><td colSpan={6}>Aucun compte revendeur.</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="card max-w-xl p-4">
        <h2 className="text-xl">Créer un compte revendeur</h2>
        <p className="mt-1 text-sm text-encre/70">Le compte est créé « en attente ». Un mot de passe provisoire s&apos;affiche une seule fois : transmettez-le au revendeur par un canal sûr ; il pourra le changer dans « Mon compte ».</p>
        <form action={createReseller} className="mt-3 grid gap-3">
          <div><label htmlFor="email" className="field-label">Email *</label><input id="email" name="email" type="email" required className="field" /></div>
          <div><label htmlFor="company_name" className="field-label">Société / boutique</label><input id="company_name" name="company_name" className="field" /></div>
          <div><label htmlFor="contact_name" className="field-label">Nom du contact</label><input id="contact_name" name="contact_name" className="field" /></div>
          <div>
            <label htmlFor="declared_country" className="field-label">Pays de résidence déclaré</label>
            <select id="declared_country" name="declared_country" className="field"><option value="">—</option><option value="DZ">Algérie</option><option value="FR">France</option></select>
          </div>
          <button className="btn-primary btn-small">Créer le compte</button>
        </form>
      </section>
    </div>
  );
}
