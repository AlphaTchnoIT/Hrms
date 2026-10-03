export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "YYYY-MM-DD" strings are treated as local calendar dates (no timezone shift)
function toDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-IN', options) : '—';
}

export function formatDay(value) {
  return formatDate(value, { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? `${formatDate(date)}, ${formatTime(date)}` : '—';
}

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
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

// Date object -> "YYYY-MM-DD" in local time (for <input type="date">)
export function toInputDate(value = new Date()) {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
