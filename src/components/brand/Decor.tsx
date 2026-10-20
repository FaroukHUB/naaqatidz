/**
 * Éléments décoratifs inspirés des packagings Naaqati (dunes, étoiles, filets),
 * dessinés uniquement avec la palette fournie. Purement décoratifs : aria-hidden.
 */

export function Dunes({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const [a, b, c] = tone === "light" ? ["#EBD2BB", "#C09064", "#DFAD6D"] : ["#5C3B2A", "#6B440A", "#845913"];
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 1440 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 150 C 180 90 330 95 520 140 C 700 182 850 120 1020 108 C 1190 96 1320 140 1440 128 L1440 220 L0 220 Z" fill={a} opacity="0.9" />
      <path d="M0 182 C 220 128 410 150 600 175 C 790 200 980 140 1160 150 C 1290 158 1380 176 1440 170 L1440 220 L0 220 Z" fill={b} opacity="0.55" />
      <path d="M0 205 C 260 178 520 196 760 202 C 1000 208 1220 186 1440 198 L1440 220 L0 220 Z" fill={c} opacity="0.45" />
    </svg>
  );
}

export function Sparkle({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0 C 13 8 16 11 24 12 C 16 13 13 16 12 24 C 11 16 8 13 0 12 C 8 11 11 8 12 0 Z" fill="currentColor" />
    </svg>
  );
}

/** Titre de section : sur-titre, titre Cinzel, filet doré. */
export function SectionTitle({ kicker, title, id, align = "center", tone = "light" }: { kicker?: string; title: string; id?: string; align?: "center" | "left"; tone?: "light" | "dark" }) {
  const center = align === "center";
  return (
    <div className={center ? "text-center" : ""}>
      {kicker && <p className={`kicker ${tone === "dark" ? "text-or" : ""}`}>{kicker}</p>}
      <h2 id={id} className={`title-display mt-3 text-2xl sm:text-3xl ${tone === "dark" ? "text-or" : ""}`}>{title}</h2>
      <div className={`mt-4 flex items-center gap-2 ${center ? "justify-center" : ""} ${tone === "dark" ? "text-or" : "text-kraft"}`}>
        <span className="h-px w-10 bg-current opacity-60" />
        <Sparkle size={10} />
        <span className="h-px w-10 bg-current opacity-60" />
      </div>
    </div>
  );
}
