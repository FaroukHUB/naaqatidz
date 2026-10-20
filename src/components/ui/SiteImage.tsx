import Image from "next/image";
import type { ImageView } from "@/lib/catalog/types";

/** Image du catalogue avec dimensions, texte alternatif et aperçu flou. Affiche un fond neutre si aucune photo n'est disponible. */
export function SiteImage({ image, sizes, priority, className }: { image: ImageView | null; sizes: string; priority?: boolean; className?: string }) {
  if (!image) {
    return (
      <div className={`flex aspect-square w-full items-center justify-center bg-creme text-sm text-marron/60 ${className ?? ""}`} aria-hidden="true">
        Photo à venir
      </div>
    );
  }
  return (
    <Image
      src={image.url}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      priority={priority}
      placeholder={image.lqip ? "blur" : "empty"}
      blurDataURL={image.lqip ?? undefined}
      className={className}
    />
  );
}
