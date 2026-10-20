/** N'accepte qu'un chemin interne (évite les redirections ouvertes vers un site tiers). */
export function safeNext(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
