/**
 * Parse a free-form currency string (e.g. "1,234.56", "$1234", "1234,56")
 * into integer cents. Returns `null` for invalid input, `0` for empty.
 */
export function parseCurrencyToCents(value: string): number | null {
  const raw = value.trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/\s|\$/g, "");
  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  let normalized = sanitized;

  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")) {
      normalized = sanitized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = sanitized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = sanitized.replace(/\./g, "").replace(",", ".");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

/**
 * Format integer cents as a display string in es-MX locale (e.g. "1,234.56").
 * Does NOT include the currency symbol — use alongside a `$` prefix UI element.
 */
export function centsToMxDisplay(cents: number): string {
  return (cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
