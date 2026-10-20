"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/lib/actions/auth";
import { Notice } from "@/components/ui/Notice";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="card mt-6 space-y-4 p-4">
      <h2 className="text-xl">Changer de mot de passe</h2>
      <div>
        <label htmlFor="password" className="field-label">Nouveau mot de passe (10 caractères minimum)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="field" />
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">Confirmer</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <button className="btn-primary" disabled={pending}>Enregistrer</button>
    </form>
  );
}
