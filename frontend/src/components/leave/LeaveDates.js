import { formatDate, titleCase } from '@/lib/format';

// "02 Oct 2026 → 05 Oct 2026" or "02 Oct 2026 · First Half"
export default function LeaveDates({ leave }) {
  if (leave.isHalfDay) return `${formatDate(leave.fromDate)} · ${titleCase(leave.halfDaySession)}`;
  if (leave.fromDate === leave.toDate) return formatDate(leave.fromDate);
  return `${formatDate(leave.fromDate)} → ${formatDate(leave.toDate)}`;
}
