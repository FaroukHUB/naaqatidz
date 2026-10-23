import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createAdmin, setAdminAccess } from "@/lib/actions/admin";
import { publicEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/server/viewer";
import { createSessionClient } from "@/lib/supabase/server";
import { Flash } from "../Flash";
import { CredentialsCard } from "../revendeurs/CredentialsCard";

export const metadata: Metadata = { title: "Administrateurs" };

type Props = { searchParams: Promise<{ ok?: string; erreur?: string; nouveau?: string }> };

export default async function AdminsPage({ searchParams }: Props) {
  const flash = await searchParams;
  const me = await requireAdmin();
  const supabase = await createSessionClient();
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, email, contact_name, status, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  // Identifiants du compte qui vient d'être créé (cookie httpOnly de 30 minutes, jamais dans l'URL).
  const temp = (await cookies()).get("nq_mdp_provisoire")?.value;
  const created = flash.nouveau ? rows?.find((r) => r.id === flash.nouveau) : undefined;
  const password = created && temp?.startsWith(`${created.id}:`) ? temp.slice(created.id.length + 1) : null;
  const message = created && password
    ? [
        `Bonjour${created.contact_name ? ` ${created.contact_name}` : ""},`,
        "",
        "Votre accès à l'administration Naaqati est prêt.",
        `Connexion : ${publicEnv.siteUrl}/connexion?suite=/admin`,
        `Email : ${created.email}`,
        `Mot de passe : ${password}`,
      ].join("\n")
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl">Administrateurs</h1>
        <p className="mt-1 text-encre/70">Les administrateurs ont accès à tout le tableau de bord : commandes, revendeurs, tarifs, livraison et paramètres.</p>
      </div>
      <Flash params={flash} />
      {message && <CredentialsCard message={message} phone={null} />}

      <section className="card p-5">
        <h2 className="text-xl">Ajouter un administrateur</h2>
        <form action={createAdmin} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="email" className="field-label">Email *</label>
            <input id="email" name="email" type="email" required autoComplete="off" className="field" />
          </div>
          <div><label htmlFor="contact_name" className="field-label">Nom et prénom</label><input id="contact_name" name="contact_name" className="field" /></div>
          <div>
            <label htmlFor="password" className="field-label">Mot de passe</label>
            <input id="password" name="password" type="text" minLength={8} autoComplete="off" placeholder="Laisser vide = créé automatiquement" className="field" />
          </div>
          <div className="sm:col-span-2"><button className="btn-primary">Ajouter l&apos;administrateur</button></div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xl">Comptes administrateurs ({rows?.length ?? 0})</h2>
        <div className="overflow-x-auto rounded-lg border border-sable bg-white">
          <table className="table-admin">
            <thead><tr><th>Nom</th><th>Email</th><th>Accès</th><th></th></tr></thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.contact_name ?? "—"}{r.id === me.userId && <span className="ml-2 text-xs text-encre/60">(vous)</span>}</td>
                  <td>{r.email}</td>
                  <td>{r.status === "active" ? "Actif" : "Retiré"}</td>
                  <td>
                    {r.id !== me.userId && (
                      <form action={setAdminAccess}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value={r.status === "active" ? "suspended" : "active"} />
                        <button className="text-sm font-semibold text-titre underline">{r.status === "active" ? "Retirer l'accès" : "Rétablir l'accès"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-encre/60">Mot de passe oublié : « Mot de passe oublié ? » sur la page de connexion (un email est envoyé).</p>
      </section>
    </div>
  );
}
