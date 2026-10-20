"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { RETAIL_SCOPE, useCart } from "@/components/cart/cart-store";
import { AddressFields, type WilayaOption } from "@/components/checkout/AddressFields";
import { IssuesList, QuoteSummary } from "@/components/checkout/QuoteSummary";
import { ShippingOptions } from "@/components/checkout/ShippingOptions";
import { useQuote } from "@/components/checkout/useQuote";
import { Notice } from "@/components/ui/Notice";

function newKey() {
  return crypto.randomUUID();
}

export function CheckoutForm({ wilayas }: { wilayas: WilayaOption[] }) {
  const router = useRouter();
  const cart = useCart(RETAIL_SCOPE);
  const [dest, setDest] = useState({ wilayaCode: "", communeCode: "" });
  const [methodId, setMethodId] = useState<string | null>(null);
  const [fields, setFields] = useState({ firstName: "", lastName: "", phone: "", email: "", address: "", notes: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Clé d'idempotence : conservée en cas d'erreur réseau (nouvel essai sans doublon), renouvelée après un refus.
  const idempotencyKey = useRef<string | null>(null);
  const ids = { first: useId(), last: useId(), phone: useId(), email: useId(), address: useId(), notes: useId() };

  const lines = cart.entries.map((e) => ({ sku: e.sku, quantity: e.quantity }));
  const destination = dest.wilayaCode && dest.communeCode ? dest : null;
  const { quote, error: quoteError, loading } = useQuote("/api/panier/devis", lines.length ? { lines, destination, shippingMethodId: methodId } : null);

  if (cart.entries.length === 0 && !submitting) {
    return (
      <div className="mt-8 rounded-lg bg-creme p-8 text-center">
        <p className="text-lg">Votre panier est vide.</p>
        <Link href="/boutique" className="btn-primary mt-4">Découvrir la boutique</Link>
      </div>
    );
  }

  const set = (k: keyof typeof fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // protection contre le double clic côté navigateur (le serveur protège aussi)
    setSubmitting(true);
    setSubmitError(null);
    idempotencyKey.current ??= newKey();
    try {
      const res = await fetch("/api/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          lines,
          firstName: fields.firstName,
          lastName: fields.lastName,
          phone: fields.phone,
          email: fields.email,
          address: { wilayaCode: dest.wilayaCode, communeCode: dest.communeCode, address: fields.address, notes: fields.notes },
          shippingMethodId: methodId,
          website: fields.website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reference) {
        cart.clear();
        router.replace(`/commande/confirmation/${encodeURIComponent(data.reference)}`);
        return;
      }
      if (res.status >= 400 && res.status < 500) idempotencyKey.current = null;
      setErrors(data.fieldErrors ?? {});
      setSubmitError(data.error ?? "La commande n'a pas pu être enregistrée.");
      setSubmitting(false);
    } catch {
      // Résultat inconnu : on garde la même clé pour qu'un nouvel essai ne crée pas de doublon.
      setSubmitError("Connexion interrompue. Vérifiez votre réseau puis renvoyez : la commande ne sera pas dupliquée.");
      setSubmitting(false);
    }
  }

  const canSubmit = !!quote?.canOrder && !loading && !submitting;

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-6">
        <fieldset className="card space-y-4 p-4">
          <legend className="px-1 font-serif text-2xl text-marron">Vos coordonnées</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.first} className="field-label">Prénom *</label>
              <input id={ids.first} className="field" autoComplete="given-name" required value={fields.firstName} onChange={set("firstName")} aria-invalid={!!errors.firstName} />
              {errors.firstName && <p className="field-error">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor={ids.last} className="field-label">Nom *</label>
              <input id={ids.last} className="field" autoComplete="family-name" required value={fields.lastName} onChange={set("lastName")} aria-invalid={!!errors.lastName} />
              {errors.lastName && <p className="field-error">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label htmlFor={ids.phone} className="field-label">Téléphone *</label>
            <input id={ids.phone} className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="0550 12 34 56" required value={fields.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
            {errors.phone ? <p className="field-error">{errors.phone}</p> : <p className="mt-1 text-sm text-encre/70">Utilisé pour le suivi de la commande et la livraison.</p>}
          </div>
          <div>
            <label htmlFor={ids.email} className="field-label">Email (facultatif)</label>
            <input id={ids.email} className="field" type="email" autoComplete="email" value={fields.email} onChange={set("email")} aria-invalid={!!errors.email} />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          {/* Champ piège pour les robots, invisible pour les personnes. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>Site web<input tabIndex={-1} autoComplete="off" value={fields.website} onChange={set("website")} /></label>
          </div>
        </fieldset>

        <fieldset className="card space-y-4 p-4">
          <legend className="px-1 font-serif text-2xl text-marron">Livraison en Algérie</legend>
          <AddressFields wilayas={wilayas} wilayaCode={dest.wilayaCode} communeCode={dest.communeCode} onChange={(v) => { setDest(v); setMethodId(null); }} errors={errors} />
          <div>
            <label htmlFor={ids.address} className="field-label">Adresse *</label>
            <textarea id={ids.address} className="field min-h-20" autoComplete="street-address" required value={fields.address} onChange={set("address")} aria-invalid={!!errors["address.address"]} />
            {errors["address.address"] && <p className="field-error">{errors["address.address"]}</p>}
          </div>
          <div>
            <label htmlFor={ids.notes} className="field-label">Indications utiles (facultatif)</label>
            <textarea id={ids.notes} className="field min-h-16" placeholder="Point de repère, étage, horaires…" value={fields.notes} onChange={set("notes")} />
          </div>
          {quote && destination && <ShippingOptions quote={quote} selected={methodId} onSelect={setMethodId} />}
        </fieldset>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {quoteError && <Notice tone="error">{quoteError}</Notice>}
        {quote && <IssuesList quote={quote} only={(c) => !(c === "destination_required" && !destination) && c !== "method_required"} />}
        {quote ? <QuoteSummary quote={quote} /> : <p className="text-sm text-encre/70">Calcul du panier…</p>}
        {submitError && <Notice tone="error">{submitError}</Notice>}
        <button type="submit" className="btn-primary w-full" disabled={!canSubmit} aria-busy={submitting}>
          {submitting ? "Enregistrement…" : "Confirmer la commande"}
        </button>
        <p className="text-xs text-encre/70">
          En confirmant, vous acceptez que vos coordonnées soient utilisées pour traiter et livrer votre commande
          (voir la <Link href="/informations/confidentialite" className="underline">politique de confidentialité</Link>).
        </p>
      </div>
    </form>
  );
}
