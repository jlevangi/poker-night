// Shared number display formatters — the single source of truth for how
// currency and percentages look on every screen.
// Display only: never use these for values sent back to the API.

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const wholeCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

/** "$1,234.56" — standard money display: buy-ins, profits, totals. */
export function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return currencyFormatter.format(0);
  return currencyFormatter.format(num);
}

/** "$1,234" — whole-dollar display for chart axis labels and tight spaces. */
export function formatCurrencyWhole(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return wholeCurrencyFormatter.format(0);
  return wholeCurrencyFormatter.format(Math.round(num));
}

/** "42.5%" — percentage display (value is already 0–100, not a fraction). */
export function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return percentFormatter.format(0) + '%';
  return percentFormatter.format(num) + '%';
}
