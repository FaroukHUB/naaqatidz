import type { Metadata } from "next";
import Link from "next/link";
import { content } from "@/lib/catalog";
import { PageHeader } from "@/components/site/PageHeader";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contact",
  description: "Contacter Naaqati.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const s = await content.getSettings();
  const hasAny = s && (s.contacts.length > 0 || s.phone || s.email || s.whatsapp || s.address);
  return (
    <>
    <PageHeader kicker="Naaqati" title="Contact" intro={s?.contactIntro ?? "Une question sur nos produits ou votre commande ? Écrivez-nous."} />
    <div className="container-page max-w-3xl py-12">
      {hasAny ? (
        <dl className="card mx-auto grid max-w-xl gap-5 p-6">
          {s.contacts.map((c) => (
            <div key={c.label + c.phone}>
              <dt className="field-label">{c.label}</dt>
              <dd className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <a className="text-lg text-titre underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>
                {c.whatsapp && <a className="text-sm font-semibold text-marron underline" href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} rel="noopener noreferrer" target="_blank">WhatsApp</a>}
              </dd>
            </div>
          ))}
          {s.phone && (<div><dt className="field-label">Téléphone</dt><dd><a className="text-lg text-titre underline" href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a></dd></div>)}
          {s.whatsapp && (<div><dt className="field-label">WhatsApp</dt><dd><a className="text-lg text-titre underline" href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} rel="noopener noreferrer" target="_blank">{s.whatsapp}</a></dd></div>)}
          {s.email && (<div><dt className="field-label">Email</dt><dd><a className="text-lg text-titre underline" href={`mailto:${s.email}`}>{s.email}</a></dd></div>)}
          {s.address && (<div><dt className="field-label">Adresse</dt><dd className="whitespace-pre-line">{s.address}</dd></div>)}
          {s.openingHours && (<div><dt className="field-label">Horaires</dt><dd className="whitespace-pre-line">{s.openingHours}</dd></div>)}
        </dl>
      ) : (
        <p className="tagline text-center text-xl">Les coordonnées de contact seront bientôt disponibles.</p>
      )}
      <p className="mt-10 text-center text-sm text-encre/70">Revendeur ? Rendez-vous dans l&apos;<Link className="underline" href="/revendeur">espace revendeur</Link> ou contactez-nous pour demander un accès.</p>
    </div>
    </>
  );
}
