import Image from "next/image";
import Link from "next/link";
import type { ProductSummary } from "@/lib/catalog/types";
import { Price } from "@/components/ui/Price";
import { SiteImage } from "@/components/ui/SiteImage";

export function ProductCard({ product, headingLevel = "h3" }: { product: ProductSummary; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <Link href={`/produit/${product.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sable bg-white transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-creme">
        {product.image ? (
          <SiteImage image={product.image} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <Image src="/brand/naaqati-calligraphie.webp" alt="" width={803} height={220} unoptimized className="w-2/3 opacity-40" />
          </div>
        )}
        {product.salesMode === "presentation" && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-marron">Présentation</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.category && <p className="text-[11px] uppercase tracking-[0.2em] text-encre/50">{product.category.title}</p>}
        <Heading className="font-serif text-lg leading-snug text-marron">{product.title}</Heading>
        <div className="mt-auto pt-2">
          {product.salesMode === "presentation" ? (
            <p className="tagline text-sm">Non commandable en ligne</p>
          ) : product.fromPriceDzdMinor !== null ? (
            <p className="font-semibold text-titre">
              <Price minor={product.fromPriceDzdMinor} currency="DZD" />
            </p>
          ) : (
            <p className="tagline text-sm">Indisponible en ligne</p>
          )}
        </div>
      </div>
    </Link>
  );
}
