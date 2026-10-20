import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/domain/money";
import { readConfirmation } from "@/lib/server/confirmation";

export const metadata: Metadata = { title: "Commande enregistrée", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ reference: string }> };

export default async function ConfirmationPage({ params }: Props) {
  const { reference } = await params;
  const order = /^NQ-\d{6}-[0-9A-F]{8}$/.test(reference) ? await readConfirmation(reference).catch(() => null) : null;

  if (!order) {
    // La référence seule ne donne accès à aucun détail.
    return (
      <div className="container-page py-12">
        <h1 className="text-3xl">Confirmation de commande</h1>
        <p className="mt-4 max-w-prose text-lg">
          Le détail de cette commande n&apos;est consultable que depuis l&apos;appareil qui l&apos;a passée, pendant 30 jours.
          Pour toute question, contactez-nous en indiquant votre référence de commande.
        </p>
        <Link href="/contact" className="btn-secondary mt-6">Nous contacter</Link>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-12">
      <div className="rounded-lg border border-succes/40 bg-[#eaf2e6] p-5">
        <h1 className="text-3xl text-succes">Merci, votre commande est enregistrée</h1>
        <p className="mt-2 text-lg">Référence : <strong className="font-mono">{order.reference}</strong></p>
        <p className="mt-2">Conservez cette référence pour tout échange avec Naaqati au sujet de votre commande.</p>
      </div>
      <section className="card mt-6 p-4" aria-labelledby="detail">
        <h2 id="detail" className="text-2xl">Détail</h2>
        <ul className="mt-3 divide-y divide-sable">
          {order.items.map((i) => (
            <li key={i.sku} className="flex justify-between gap-3 py-2 text-sm">
              <span>{i.product_name}{i.variant_label ? ` — ${i.variant_label}` : ""} × {i.quantity}</span>
              <span className="font-semibold">{formatMoney(i.line_total_minor, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-sable pt-3 text-sm">
          <div className="flex justify-between"><dt>Sous-total</dt><dd>{formatMoney(order.subtotal_minor, order.currency)}</dd></div>
          <div className="flex justify-between gap-3">
            <dt>Livraison{order.shipping_method_label ? ` (${order.shipping_method_label})` : ""}</dt>
            <dd>{order.shipping_minor !== null ? formatMoney(order.shipping_minor, order.currency) : "À confirmer par Naaqati"}</dd>
          </div>
          <div className="flex justify-between border-t border-sable pt-2 text-base font-semibold">
            <dt>{order.shipping_minor !== null ? "Total à payer à la livraison" : "Total hors livraison"}</dt>
            <dd>{formatMoney(order.total_minor, order.currency)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm">Livraison : {order.ship_commune_name}, {order.ship_wilaya_name}</p>
        <p className="mt-3 rounded-md bg-creme px-3 py-2 text-sm font-semibold text-marron">Paiement à la livraison : rien n&apos;a été débité.</p>
      </section>
      <Link href="/boutique" className="btn-secondary mt-6">Retour à la boutique</Link>
    </div>
  );
}
