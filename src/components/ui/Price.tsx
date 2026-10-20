import { formatMoney } from "@/lib/domain/money";

export function Price({ minor, currency, className }: { minor: number; currency: string; className?: string }) {
  return <span className={className}>{formatMoney(minor, currency)}</span>;
}
