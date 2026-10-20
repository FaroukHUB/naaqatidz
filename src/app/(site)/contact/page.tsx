import type { Metadata } from "next";
import Link from "next/link";
import { content } from "@/lib/catalog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact",
  description: "Contacter Naaqati.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const s = await content.getSettings();
  const hasAny = s && (s.phone || s.email || s.whatsapp || s.address);
  return (
    <div className="container-page py-10">
      <h1 className="text-4xl">Contact</h1>
      {s?.contactIntro && <p className="mt-4 max-w-prose whitespace-pre-line text-lg">{s.contactIntro}</p>}
      {hasAny ? (
        <dl className="mt-8 grid max-w-xl gap-4">
          {s.phone && (<div><dt className="field-label">Téléphone</dt><dd><a className="text-lg text-titre underline" href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a></dd></div>)}
          {s.whatsapp && (<div><dt className="field-label">WhatsApp</dt><dd><a className="text-lg text-titre underline" href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} rel="noopener noreferrer" target="_blank">{s.whatsapp}</a></dd></div>)}
          {s.email && (<div><dt className="field-label">Email</dt><dd><a className="text-lg text-titre underline" href={`mailto:${s.email}`}>{s.email}</a></dd></div>)}
          {s.address && (<div><dt className="field-label">Adresse</dt><dd className="whitespace-pre-line">{s.address}</dd></div>)}
          {s.openingHours && (<div><dt className="field-label">Horaires</dt><dd className="whitespace-pre-line">{s.openingHours}</dd></div>)}
        </dl>
      ) : (
        <p className="mt-6 text-lg">Les coordonnées de contact seront bientôt disponibles.</p>
      )}
      <p className="mt-10 text-sm text-encre/70">Revendeur ? Rendez-vous dans l&apos;<Link className="underline" href="/revendeur">espace revendeur</Link> ou contactez-nous pour demander un accès.</p>
    </div>
  );
}
