"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/actions/auth";
import { Notice } from "@/components/ui/Notice";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <div className="container-page max-w-md py-12">
      <h1 className="text-3xl">Mot de passe oublié</h1>
      <form action={action} className="card mt-6 space-y-4 p-4">
        <div>
          <label htmlFor="email" className="field-label">Email du compte</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        <button className="btn-primary w-full" disabled={pending}>Recevoir un lien</button>
      </form>
    </div>
  );
}
