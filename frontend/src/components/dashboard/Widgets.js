import Link from 'next/link';
import { Cake, CalendarDays, Megaphone, PartyPopper, Pin, Plane } from 'lucide-react';
import { formatDate, formatDay, getFullName } from '@/lib/format';
import { Avatar, Badge, Card } from '@/components/ui';

const ViewAll = ({ href }) => (
  <Link href={href} className="text-xs font-medium text-brand-600 hover:text-brand-700">
    View all
  </Link>
);

function Empty({ icon: Icon, text }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-center">
      <Icon className="h-6 w-6 text-slate-300" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function UpcomingHolidays({ holidays = [] }) {
  return (
    <Card title="Upcoming holidays" icon={CalendarDays} action={<ViewAll href="/holidays" />} className="h-full">
      {!holidays.length && <Empty icon={CalendarDays} text="No upcoming holidays" />}
      <ul className="space-y-3">
        {holidays.map((h) => (
          <li key={h._id} className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
              <span className="text-[9px] font-bold uppercase text-rose-500">{formatDate(h.date, { month: 'short' })}</span>
              <span className="text-sm font-bold leading-none text-slate-800">{h.date.slice(8)}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{h.name}</p>
              <p className="text-xs text-slate-500">{formatDate(h.date, { weekday: 'long' })}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AnnouncementsWidget({ announcements = [] }) {
  return (
    <Card title="Announcements" icon={Megaphone} action={<ViewAll href="/announcements" />} className="h-full">
      {!announcements.length && <Empty icon={Megaphone} text="No announcements" />}
      <ul className="divide-y divide-slate-100">
        {announcements.slice(0, 3).map((a) => (
          <li key={a._id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              {a.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
              <p className="truncate text-sm font-semibold text-slate-800">{a.title}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.content}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Badge color="blue" dot={false}>
                {a.category}
              </Badge>
              {formatDate(a.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CelebrationsWidget({ items = [] }) {
  return (
    <Card title="Celebrations" subtitle="Next 30 days" icon={PartyPopper} className="h-full">
      {!items.length && <Empty icon={PartyPopper} text="No celebrations coming up" />}
      <ul className="space-y-3">
        {items.slice(0, 5).map((item) => (
          <li key={`${item._id}-${item.type}`} className="flex items-center gap-3">
            <Avatar name={item.name} src={item.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                {item.type === 'birthday' ? <Cake className="h-3 w-3 text-pink-500" /> : <PartyPopper className="h-3 w-3 text-amber-500" />}
                {item.type === 'birthday' ? 'Birthday' : `${item.years} year anniversary`}
              </p>
            </div>
            <span className={`text-xs font-medium ${item.inDays === 0 ? 'text-brand-600' : 'text-slate-500'}`}>
              {item.inDays === 0 ? 'Today 🎉' : formatDay(item.date)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WhoIsOutWidget({ leaves = [] }) {
  return (
    <Card title="On leave today" subtitle={`${leaves.length} people`} icon={Plane} className="h-full">
      {!leaves.length && <Empty icon={Plane} text="Everyone is in today 🙌" />}
      <ul className="space-y-3">
        {leaves.map((l) => (
          <li key={l._id} className="flex items-center gap-3">
            <Avatar name={getFullName(l.user)} src={l.user?.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{getFullName(l.user)}</p>
              <p className="text-xs text-slate-500">
                {l.fromDate === l.toDate ? 'Today' : `Until ${formatDate(l.toDate, { day: '2-digit', month: 'short' })}`}
              </p>
            </div>
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${l.leaveType?.color}1a`, color: l.leaveType?.color }}
            >
              {l.leaveType?.name}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
