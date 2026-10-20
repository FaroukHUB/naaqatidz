import { Dunes, Sparkle } from "@/components/brand/Decor";

/** Bandeau de titre des pages intérieures. */
export function PageHeader({ kicker, title, intro, children }: { kicker?: string; title: string; intro?: string | null; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-creme">
      <Sparkle className="absolute right-[10%] top-8 text-or" size={14} />
      <Sparkle className="absolute left-[6%] top-14 text-kraft/50" size={10} />
      <div className="container-page relative z-10 pb-20 pt-10 text-center md:pb-24 md:pt-14">
        {children}
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="title-display mt-3 text-3xl sm:text-4xl">{title}</h1>
        {intro && <p className="tagline mx-auto mt-4 max-w-2xl text-lg sm:text-xl">{intro}</p>}
      </div>
      <Dunes className="absolute inset-x-0 bottom-0 h-16 w-full md:h-20" />
    </section>
  );
}
