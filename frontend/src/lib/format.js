export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/*
 * Every time on screen is shown in the company timezone (Settings -> Timezone), not the
 * browser's, so a manager abroad sees the same clock as the office. Set from the login session.
 */
const LOCALE = 'en-GB';
let displayTimeZone = 'Europe/London';

export function setDisplayTimeZone(timeZone) {
  if (!timeZone) return;
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone });
    displayTimeZone = timeZone;
  } catch {
    // unknown timezone: keep the current one
  }
}

export function getDisplayTimeZone() {
  return displayTimeZone;
}

// e.g. "BST" / "GMT" for Europe/London
export function getTimeZoneLabel(date = new Date()) {
  const part = new Intl.DateTimeFormat(LOCALE, { timeZone: displayTimeZone, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName');
  return part?.value || displayTimeZone;
}

const isDateOnly = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// "YYYY-MM-DD" strings are calendar dates: they are read as UTC midnight and shown in UTC (no day shift)
function toDate(value) {
  if (!value) return null;
  if (isDateOnly(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Year, month (1-12), day, hour, minute and weekday (0 = Sunday) of a moment in the company timezone
export function zonedParts(value = new Date()) {
  const date = toDate(value) || new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: displayTimeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), weekday: weekdays.indexOf(parts.weekday) };
}

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const date = toDate(value);
  return date ? date.toLocaleDateString(LOCALE, { ...options, timeZone: isDateOnly(value) ? 'UTC' : displayTimeZone }) : '—';
}

export function formatDay(value) {
  return formatDate(value, { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: displayTimeZone }) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? `${formatDate(date)}, ${formatTime(date)}` : '—';
}

/*
 * Money is shown in the company currency (Settings -> Currency), e.g. £1,250.00 for GBP.
 * INR keeps its own digit grouping (₹1,25,000).
 */
let displayCurrency = 'GBP';

export function setDisplayCurrency(currency) {
  if (!currency) return;
  try {
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
    displayCurrency = currency.toUpperCase();
  } catch {
    // unknown currency code: keep the current one
  }
}

export function getDisplayCurrency() {
  return displayCurrency;
}

const currencyLocale = (currency) => (currency === 'INR' ? 'en-IN' : LOCALE);

// "£", "₹", "€" ... for input prefixes
export function getCurrencySymbol(currency = displayCurrency) {
  const part = new Intl.NumberFormat(currencyLocale(currency), { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value || currency;
}

export function formatCurrency(amount, currency = displayCurrency) {
  return new Intl.NumberFormat(currencyLocale(currency), { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    Number(amount) || 0
  );
}

export function minutesToHours(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function getFullName(user) {
  if (!user) return '—';
  return user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// "half-day" -> "Half Day"
export function titleCase(text = '') {
  return String(text)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Date -> "YYYY-MM-DD" in the company timezone (for <input type="date">); toInputDate() = today there
export function toInputDate(value = new Date()) {
  if (isDateOnly(value)) return value;
  if (!toDate(value)) return '';
  const { year, month, day } = zonedParts(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}
