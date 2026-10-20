"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-3xl">Un problème est survenu</h1>
      <p className="mt-3">Merci de réessayer dans un instant.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">Réessayer</button>
    </div>
  );
}
