import { isDemoCatalog } from "@/lib/env";

export function DemoBanner() {
  if (!isDemoCatalog) return null;
  return (
    <div className="bg-or px-4 py-2 text-center text-sm font-semibold text-ilaji">
      Mode démonstration (développement local) : catalogue fictif, Sanity n&apos;est pas configuré.
    </div>
  );
}
