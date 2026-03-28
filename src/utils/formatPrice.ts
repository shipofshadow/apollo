/**
 * Formats a price value as Philippine Peso: ₱1,000.00
 *
 * - Numbers are formatted directly.
 * - Strings that look like prices (optionally prefixed with ₱, commas as thousands
 *   separators) are parsed and reformatted.
 * - Non-numeric strings (e.g. "Consultation") are returned unchanged.
 */
export function formatPrice(value: number | string): string {
  if (typeof value === 'number') {
    return '₱' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Strip peso sign, commas, and leading/trailing whitespace then attempt parse
  const stripped = value.replace(/₱/g, '').replace(/,/g, '').trim();
  const num = parseFloat(stripped);

  if (!isNaN(num) && stripped !== '') {
    return '₱' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Non-numeric string (e.g. "Consultation") — return as-is
  return value;
}
