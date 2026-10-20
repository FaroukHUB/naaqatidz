import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-serif text-4xl text-marron">Page introuvable</h1>
      <p className="mt-4 text-lg">Cette page n&apos;existe pas ou n&apos;est plus disponible.</p>
      <Link href="/boutique" className="btn-primary mt-6">Voir la boutique</Link>
    </main>
  );
}
