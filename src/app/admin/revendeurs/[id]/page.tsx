import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { updateReseller } from "@/lib/actions/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/Notice";
import { Flash } from "../../Flash";

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

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/revendeurs" className="text-sm underline">← Revendeurs</Link>
      <h1 className="text-2xl">{p.email}</h1>
      <Flash params={flash} />
      {tempPassword && (
        <Notice tone="warning" title="Mot de passe provisoire (affiché pendant 2 minutes)">
          <p className="font-mono text-base">{tempPassword}</p>
          <p>Transmettez-le au revendeur par un canal sûr. Il ne sera plus affiché.</p>
        </Notice>
      )}
      <p className="text-sm text-encre/70">{count ?? 0} commande(s) · Pays déclaré : {p.declared_country ?? "—"}{p.validated_at ? ` · Validé le ${new Date(p.validated_at).toLocaleDateString("fr-FR")}` : ""}</p>
      <form action={updateReseller} className="card grid gap-4 p-4">
        <input type="hidden" name="id" value={p.id} />
        <div>
          <label htmlFor="status" className="field-label">Statut du compte</label>
          <select id="status" name="status" defaultValue={p.status} className="field">
            <option value="pending">En attente</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
          </select>
        </div>
        <div>
          <label htmlFor="validated_country" className="field-label">Pays de résidence validé (détermine les tarifs)</label>
          <select id="validated_country" name="validated_country" defaultValue={p.validated_country ?? ""} className="field">
            <option value="">Non validé</option>
            <option value="DZ">Algérie — prix publics DZD, paiement à la livraison</option>
            <option value="FR">France — tarifs revendeurs France</option>
          </select>
          <p className="mt-1 text-xs text-encre/70">Le pays de résidence n&apos;est pas le pays de livraison. Vérifiez-le avant d&apos;activer le compte.</p>
        </div>
        <div><label htmlFor="company_name" className="field-label">Société / boutique</label><input id="company_name" name="company_name" defaultValue={p.company_name ?? ""} className="field" /></div>
        <div><label htmlFor="contact_name" className="field-label">Nom du contact</label><input id="contact_name" name="contact_name" defaultValue={p.contact_name ?? ""} className="field" /></div>
        <div><label htmlFor="phone" className="field-label">Téléphone</label><input id="phone" name="phone" defaultValue={p.phone ?? ""} className="field" /></div>
        <div><label htmlFor="admin_notes" className="field-label">Notes internes</label><textarea id="admin_notes" name="admin_notes" defaultValue={p.admin_notes ?? ""} className="field" rows={3} /></div>
        <button className="btn-primary btn-small">Enregistrer</button>
      </form>
    </div>
  );
}
