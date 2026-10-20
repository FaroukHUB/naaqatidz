export default function Loading() {
  return (
    <div className="container-page py-16" role="status" aria-live="polite">
      <div className="mx-auto h-1 w-40 animate-pulse rounded bg-kraft/60" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
