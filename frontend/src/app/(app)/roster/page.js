'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { CalendarRange, Clock, Coffee } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { formatDay, formatTime, minutesToHours } from '@/lib/format';
import { Badge, Card, ErrorMessage, PageHeader, PageLoader, StatCard, Tabs } from '@/components/ui';
import { AdherenceTrendChart } from '@/components/performance/KpiWidgets';

const DAY_STYLES = {
  'weekly-off': 'bg-slate-50 border-slate-200',
  holiday: 'bg-sky-50 border-sky-200',
  'sick-leave': 'bg-violet-50 border-violet-200',
  'emergency-leave': 'bg-violet-50 border-violet-200',
  'approved-leave': 'bg-violet-50 border-violet-200',
};

function ScheduleTab() {
  const { data, loading, error, refetch } = useFetch('/workforce/roster/my');
  if (loading && !data) return <PageLoader />;
  if (!data) return <ErrorMessage message={error} onRetry={refetch} />;
  const working = data.days.filter((d) => !d.shift.isWeeklyOff && d.status !== 'holiday');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Working days (next 2 weeks)" value={working.length} icon={CalendarRange} />
        <StatCard label="Scheduled hours" value={minutesToHours(data.scheduledMinutes)} icon={Clock} tone="blue" />
        <StatCard label="Weekly offs" value={data.days.filter((d) => d.shift.isWeeklyOff).length} icon={Coffee} tone="green" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {data.days.map((d) => (
          <div key={d.date} className={clsx('rounded-xl border bg-white p-3', DAY_STYLES[d.status])}>
            <p className="text-xs font-semibold text-slate-500">{formatDay(d.date)}</p>
            {d.shift.isWeeklyOff ? (
              <p className="mt-2 font-semibold text-slate-700">Weekly off</p>
            ) : d.holiday ? (
              <p className="mt-2 font-semibold text-sky-700">{d.holiday}</p>
            ) : (
              <>
                <p className="mt-2 font-semibold text-slate-900">{d.shift.shiftName}</p>
                <p className="text-sm text-slate-600">
                  {d.shift.startTime} – {d.shift.endTime}
                </p>
                <p className="text-xs text-slate-500">{minutesToHours(d.scheduledMinutes)}</p>
              </>
            )}
            <div className="mt-2">
              <Badge status={d.status} />
            </div>
            {d.shift.isDefault && !d.shift.isWeeklyOff && <p className="mt-1 text-[11px] text-slate-400">Default office timing</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceStatusTab() {
  const { data, loading, error, refetch } = useFetch('/workforce/attendance/my');
  if (loading && !data) return <PageLoader />;
  if (!data) return <ErrorMessage message={error} onRetry={refetch} />;
  const s = data.summary;
  const tiles = [
    ['Present', s.present, 'green'],
    ['Late login', s.lateLogins, 'yellow'],
    ['Short login', s.shortLogins, 'yellow'],
    ['Absent', s.absent, 'red'],
    ['Sick leave', s.sickLeave, 'purple'],
    ['Emergency leave', s.emergencyLeave, 'purple'],
    ['Approved leave', s.approvedLeave, 'purple'],
    ['Weekly off', s.weeklyOffs, 'gray'],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {tiles.map(([label, value, tone]) => (
          <StatCard key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
      <Card title="This month" subtitle={`Login ${minutesToHours(s.loginMinutes)} of ${minutesToHours(s.scheduledMinutes)} scheduled · adherence ${s.adherencePercent ?? '—'}%`} noPadding>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Login</th>
                <th className="px-4 py-3">AT (productive)</th>
                <th className="px-4 py-3">Idle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data.days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium text-slate-700">{formatDay(d.date)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{d.shift.isWeeklyOff ? '—' : `${d.shift.startTime}–${d.shift.endTime}`}</td>
                  <td className="px-4 py-2.5">
                    <Badge status={d.status} />
                    {d.isLate && <span className="ml-1 text-xs text-amber-600">+{d.lateByMinutes}m</span>}
                  </td>
                  <td className="px-4 py-2.5">{d.checkIn ? formatTime(d.checkIn) : '—'}</td>
                  <td className="px-4 py-2.5">{d.checkOut ? formatTime(d.checkOut) : '—'}</td>
                  <td className="px-4 py-2.5">{d.loginMinutes ? minutesToHours(d.loginMinutes) : '—'}</td>
                  <td className="px-4 py-2.5">{d.productiveMinutes !== null ? minutesToHours(d.productiveMinutes) : '—'}</td>
                  <td className={clsx('px-4 py-2.5', d.isIdle && 'font-semibold text-rose-600')}>{d.idleMinutes !== null ? minutesToHours(d.idleMinutes) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TrendsTab() {
  const { data, loading } = useFetch('/workforce/trends', { params: { months: 3 } });
  if (loading && !data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <Card title="Attendance, login & shift adherence" subtitle="Previous three months">
        <AdherenceTrendChart data={data?.all} target={data?.adherenceTarget} />
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {(data?.all || []).map((m) => (
          <Card key={m.month} title={m.month}>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">Attendance</dt>
              <dd className="font-semibold">{m.attendancePercent ?? '—'}%</dd>
              <dt className="text-slate-500">Adherence</dt>
              <dd className="font-semibold">{m.adherencePercent ?? '—'}%</dd>
              <dt className="text-slate-500">Login hours</dt>
              <dd className="font-semibold">{m.loginHoursPercent ?? '—'}% of shift</dd>
              <dt className="text-slate-500">Late / short</dt>
              <dd className="font-semibold">
                {m.lateLogins} / {m.shortLogins}
              </dd>
              <dt className="text-slate-500">Absent</dt>
              <dd className="font-semibold">{m.absent}</dd>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function MyRosterPage() {
  const [tab, setTab] = useState('schedule');
  return (
    <div>
      <PageHeader title="My Roster & Attendance" subtitle="Assigned shifts, weekly offs and scheduled hours for the next two weeks" />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'schedule', label: 'Next 2 weeks' },
          { value: 'status', label: 'Attendance status' },
          { value: 'trends', label: 'Adherence trends' },
        ]}
      />
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'status' && <AttendanceStatusTab />}
      {tab === 'trends' && <TrendsTab />}
    </div>
  );
}
