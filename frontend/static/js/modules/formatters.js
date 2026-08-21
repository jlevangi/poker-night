// Shared display formatters — the single source of truth for how currency,
// dates, and percentages look on every screen.
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

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

// Coerce an API value to a local Date, or null when unparseable.
// Bare ISO dates (YYYY-MM-DD) get a T00:00:00 suffix so they parse as
// local time; a bare date string parses as midnight UTC, which shifts
// the day back in negative-offset timezones.
function toDisplayDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const str = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T00:00:00') : new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "Aug 20, 2026" — standard date for lists, rows, cards, and titles.
export function formatDate(value) {
  const date = toDisplayDate(value);
  if (!date) return 'Unknown Date';
  return dateFormatter.format(date);
}

// "Wednesday, August 20, 2026" — long date for event headers.
export function formatDateLong(value) {
  const date = toDisplayDate(value);
  if (!date) return 'Unknown Date';
  return longDateFormatter.format(date);
}
