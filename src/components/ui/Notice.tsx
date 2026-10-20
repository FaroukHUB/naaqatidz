import type { ReactNode } from "react";

const styles = {
  info: "border-kraft/60 bg-creme text-encre",
  warning: "border-or bg-sable/60 text-encre",
  error: "border-erreur/40 bg-rose/60 text-erreur",
  success: "border-succes/40 bg-[#eaf2e6] text-succes",
} as const;

export function Notice({ tone = "info", title, children }: { tone?: keyof typeof styles; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm leading-relaxed ${styles[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}
