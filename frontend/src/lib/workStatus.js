// Live Work Status: colours and labels per category (statuses themselves come from Settings)
export const WORK_CATEGORIES = {
  productive: { label: 'Productive', dot: 'bg-emerald-500', bar: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200', tone: 'green' },
  approved: { label: 'Meetings & training', dot: 'bg-sky-500', bar: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 border-sky-200', tone: 'blue' },
  system: { label: 'System / IT', dot: 'bg-violet-500', bar: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700 border-violet-200', tone: 'purple' },
  break: { label: 'Break', dot: 'bg-amber-500', bar: 'bg-amber-400', soft: 'bg-amber-50 text-amber-700 border-amber-200', tone: 'yellow' },
  inactive: { label: 'Away', dot: 'bg-slate-400', bar: 'bg-slate-300', soft: 'bg-slate-100 text-slate-600 border-slate-200', tone: 'gray' },
  offline: { label: 'Offline', dot: 'bg-slate-300', bar: 'bg-slate-200', soft: 'bg-white text-slate-500 border-slate-200', tone: 'gray' },
};

export const WORK_CATEGORY_KEYS = ['productive', 'approved', 'system', 'break', 'inactive'];

// Simple presence colleagues see in the directory / org chart
export const PRESENCE = {
  available: { label: 'Available', dot: 'bg-emerald-500' },
  busy: { label: 'Busy', dot: 'bg-rose-500' },
  away: { label: 'Away', dot: 'bg-amber-400' },
  offline: { label: 'Offline', dot: 'bg-slate-300' },
};

export const WORK_STATUS_UPDATED_EVENT = 'work-status-updated';

// "1h 05m" style, for live durations
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function minutesSince(date, now = Date.now()) {
  return date ? (now - new Date(date).getTime()) / 60000 : 0;
}
