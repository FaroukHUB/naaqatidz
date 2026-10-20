import { Notice } from "@/components/ui/Notice";

export function Flash({ params }: { params: { ok?: string; erreur?: string } }) {
  return (
    <div className="mb-4 space-y-2 empty:hidden">
      {params.ok && <Notice tone="success">{params.ok}</Notice>}
      {params.erreur && <Notice tone="error">{params.erreur}</Notice>}
    </div>
  );
}
