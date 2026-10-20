/**
 * Chargeur d'images : les photos Sanity sont redimensionnées et converties (WebP/AVIF)
 * directement par le CDN d'images Sanity ; les fichiers locaux (logo) sont servis tels quels.
 */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (!src.startsWith("https://cdn.sanity.io/")) return src;
  const url = new URL(src);
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 75));
  return url.href;
}
