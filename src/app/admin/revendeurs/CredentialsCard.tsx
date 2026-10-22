"use client";

import { useState } from "react";

/** Identifiants à transmettre au revendeur : message prêt à copier ou à envoyer par WhatsApp. */
export function CredentialsCard({ message, phone }: { message: string; phone: string | null }) {
  const [copied, setCopied] = useState(false);
  const digits = phone?.replace(/\D/g, "") ?? "";
  const whatsapp = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-lg border-2 border-or bg-sable/40 p-5">
      <h2 className="text-xl">Identifiants à envoyer au revendeur</h2>
      <p className="mt-1 text-sm text-encre/70">Affichés pendant 30 minutes. Si vous les perdez, créez simplement un nouveau mot de passe plus bas.</p>
      <pre className="mt-4 whitespace-pre-wrap rounded-md bg-white p-4 font-sans text-base leading-relaxed">{message}</pre>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={copy} className="btn-primary btn-small">{copied ? "Copié ✓" : "Copier le message"}</button>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-small">
          Envoyer par WhatsApp{digits ? "" : " (choisir le contact)"}
        </a>
      </div>
    </section>
  );
}
