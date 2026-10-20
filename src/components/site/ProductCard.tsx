import Link from "next/link";
import type { ProductSummary } from "@/lib/catalog/types";
import { Price } from "@/components/ui/Price";
import { SiteImage } from "@/components/ui/SiteImage";

export function ProductCard({ product, headingLevel = "h3" }: { product: ProductSummary; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <Link href={`/produit/${product.slug}`} className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="aspect-square overflow-hidden bg-creme">
        <SiteImage image={product.image} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Heading className="text-lg leading-snug">{product.title}</Heading>
        {product.salesMode === "presentation" ? (
          <p className="mt-auto text-sm text-marron/80">Non commandable en ligne</p>
        ) : product.fromPriceDzdMinor !== null ? (
          <p className="mt-auto font-semibold text-titre">
            <Price minor={product.fromPriceDzdMinor} currency="DZD" />
          </p>
        ) : (
          <p className="mt-auto text-sm text-marron/80">Indisponible en ligne</p>
        )}
      </div>
    </Link>
  );
}
