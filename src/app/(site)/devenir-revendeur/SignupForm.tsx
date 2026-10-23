"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerReseller, type SignupState } from "@/lib/actions/auth";
import { AddressFields, type WilayaOption } from "@/components/checkout/AddressFields";
import { Notice } from "@/components/ui/Notice";

export function SignupForm({ wilayas }: { wilayas: WilayaOption[] }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(registerReseller, {});
  const [country, setCountry] = useState<"DZ" | "FR">("DZ");
  const [dest, setDest] = useState({ wilayaCode: "", communeCode: "" });
  const err = (k: string) => state.fieldErrors?.[k] && <p className="field-error">{state.fieldErrors[k]}</p>;
  const card = "flex cursor-pointer gap-3 rounded-md border border-sable bg-white p-3 has-[:checked]:border-symbole has-[:checked]:bg-creme";

  return (
    <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
      {/* Champ piège pour les robots : invisible, doit rester vide. */}
      <div aria-hidden="true" className="hidden"><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <fieldset className="sm:col-span-2">
        <legend className="field-label">Vous êtes installé en *</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <label className={card}>
            <input type="radio" name="country" value="DZ" checked={country === "DZ"} onChange={() => setCountry("DZ")} />
            <span><strong>Algérie</strong><br /><span className="text-sm text-encre/70">Compte actif tout de suite, prix publics en DZD, sans limite de quantité.</span></span>
          </label>
          <label className={card}>
            <input type="radio" name="country" value="FR" checked={country === "FR"} onChange={() => setCountry("FR")} />
            <span><strong>France</strong><br /><span className="text-sm text-encre/70">Tarifs dédiés : compte activé par Naaqati après vérification.</span></span>
          </label>
        </div>
      </fieldset>

      <div><label htmlFor="contact_name" className="field-label">Nom et prénom *</label><input id="contact_name" name="contact_name" autoComplete="name" required className="field" />{err("contact_name")}</div>
      <div><label htmlFor="company_name" className="field-label">Boutique / société</label><input id="company_name" name="company_name" autoComplete="organization" className="field" /></div>
      <div><label htmlFor="phone" className="field-label">Téléphone / WhatsApp *</label><input id="phone" name="phone" type="tel" autoComplete="tel" required className="field" placeholder={country === "DZ" ? "0550 12 34 56" : "+33 6 …"} />{err("phone")}</div>
      <div><label htmlFor="email" className="field-label">Email *</label><input id="email" name="email" type="email" autoComplete="email" required className="field" />{err("email")}</div>
      <div className="sm:col-span-2">
        <label htmlFor="password" className="field-label">Mot de passe * <span className="font-normal text-encre/60">(8 caractères minimum)</span></label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />{err("password")}
      </div>

      <fieldset className="grid gap-4 sm:col-span-2">
        <legend className="field-label">Adresse de livraison — enregistrée et pré-remplie à chaque commande</legend>
        {country === "DZ" ? (
          <>
            <AddressFields wilayas={wilayas} wilayaCode={dest.wilayaCode} communeCode={dest.communeCode} onChange={setDest} errors={state.fieldErrors?.ship_commune_code ? { "address.communeCode": state.fieldErrors.ship_commune_code } : undefined} />
            <input type="hidden" name="ship_wilaya_code" value={dest.wilayaCode} />
            <input type="hidden" name="ship_commune_code" value={dest.communeCode} />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="ship_postal_code" className="field-label">Code postal *</label><input id="ship_postal_code" name="ship_postal_code" inputMode="numeric" autoComplete="postal-code" className="field" placeholder="75011" />{err("ship_postal_code")}</div>
            <div><label htmlFor="ship_city" className="field-label">Ville *</label><input id="ship_city" name="ship_city" autoComplete="address-level2" className="field" />{err("ship_city")}</div>
          </div>
        )}
        <div><label htmlFor="ship_address" className="field-label">Adresse (rue, numéro{country === "DZ" ? ", quartier" : ""}) *</label><textarea id="ship_address" name="ship_address" rows={2} autoComplete="street-address" className="field" />{err("ship_address")}</div>
      </fieldset>

      <div className="space-y-3 sm:col-span-2">
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <button className="btn-primary w-full sm:w-auto sm:px-10" disabled={pending}>{pending ? "Création du compte…" : "Créer mon compte revendeur"}</button>
        <p className="text-sm text-encre/70">Déjà un compte ? <Link href="/connexion" className="underline">Se connecter</Link></p>
      </div>
    </form>
  );
}
