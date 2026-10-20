/** Montants stockés en unités mineures entières (centimes) pour éviter les erreurs d'arrondi. */

const EXPONENTS: Record<string, number> = { DZD: 2, EUR: 2, USD: 2, GBP: 2, CHF: 2 };

export function currencyExponent(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/** Convertit un montant saisi en unités majeures (ex. 1200 DA) en unités mineures entières. */
export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

export function formatMoney(minor: number, currency: string): string {
  const major = toMajor(minor, currency);
  const whole = Number.isInteger(major);
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

export function isValidCurrencyCode(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}
