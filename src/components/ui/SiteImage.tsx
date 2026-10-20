import Image from "next/image";
import type { ImageView } from "@/lib/catalog/types";

/** Image du catalogue avec dimensions, texte alternatif et aperçu flou. Affiche un fond neutre si aucune photo n'est disponible. */
export function SiteImage({ image, sizes, priority, className }: { image: ImageView | null; sizes: string; priority?: boolean; className?: string }) {
  if (!image) {
    return (
      <div className={`flex aspect-square w-full items-center justify-center bg-creme ${className ?? ""}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/naaqati-calligraphie.webp" alt="" width={803} height={220} className="w-1/2 opacity-30" />
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
