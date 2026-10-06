'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { formatTime, getFullName, toInputDate } from '@/lib/format';
import { WORK_CATEGORIES, WORK_CATEGORY_KEYS, formatMinutes, minutesSince } from '@/lib/workStatus';
import { Button, Card, DataTable, ErrorMessage, Input, Modal, PageHeader, PageLoader, Select } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';
import EmployeeCell from '@/components/shared/EmployeeCell';
import StatusPill from '@/components/workStatus/StatusPill';
import DayTimeline from '@/components/workStatus/DayTimeline';

const REFRESH_MS = 30000;

// One employee's day, opened from the board
function PersonDayModal({ member, onClose }) {
  const [date, setDate] = useState(toInputDate());
  const { data, loading, error, refetch } = useFetch(member ? '/work-status/day' : null, { params: { user: member?.user._id, date } });

  return (
    <Modal open={Boolean(member)} onClose={onClose} size="xl" title={member ? getFullName(member.user) : ''} description="Live Work Status timeline">
      <div className="mb-4 flex justify-end">
        <Input type="date" value={date} max={toInputDate()} onChange={(e) => setDate(e.target.value)} />
      </div>
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data ? <PageLoader /> : data && <DayTimeline day={data} />}
    </Modal>
  );
}

/*
 * Live board for team leads, managers and HR: who is doing what right now and how today is going.
 */
export default function LiveStatusPage() {
  const { isHR } = useAuth();
  const [manager, setManager] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [, setTick] = useState(0);
  const teamScope = useTeamScope({ manager });
  const managers = useFetch(isHR ? '/employees/directory' : null, { params: { role: 'manager', limit: 200 } });
  const { data, loading, error, refetch } = useFetch('/work-status/team', { params: { manager: manager || undefined, scope: teamScope.scope } });

  // Live: reload every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
      setTick((t) => t + 1);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refetch]);

  const members = useMemo(() => {
    const list = data?.members || [];
    const filtered = filter ? list.filter((m) => (m.current?.category || 'offline') === filter) : list;
    // Working people first, longest in their current status first
    return [...filtered].sort((a, b) => Boolean(b.current) - Boolean(a.current) || new Date(a.current?.since || 0) - new Date(b.current?.since || 0));
  }, [data, filter]);

  const columns = [
    { key: 'employee', header: 'Employee', render: (m) => <EmployeeCell employee={m.user} subtitle={m.user.designation?.title} /> },
    {
      key: 'status',
      header: 'Current status',
      render: (m) => (
        <div className="min-w-0">
          <StatusPill current={m.current} />
          {m.current?.note && <p className="mt-1 max-w-[16rem] truncate text-xs text-slate-500">“{m.current.note}”</p>}
        </div>
      ),
    },
    {
      key: 'since',
      header: 'For',
      render: (m) =>
        m.current ? (
          <span className={clsx('tabular-nums', m.current.category === 'break' && minutesSince(m.current.since) > 30 && 'font-semibold text-rose-600')}>
            {formatMinutes(minutesSince(m.current.since))}
          </span>
        ) : m.checkOut ? (
          <span className="text-xs text-slate-400">Out at {formatTime(m.checkOut)}</span>
        ) : (
          <span className="text-xs text-slate-400">Not checked in</span>
        ),
    },
    { key: 'productive', header: 'Productive', render: (m) => <span className="tabular-nums">{formatMinutes(m.today.categories.productive)}</span> },
    { key: 'approved', header: 'Meetings', render: (m) => <span className="tabular-nums">{formatMinutes(m.today.categories.approved)}</span> },
    { key: 'break', header: 'Break', render: (m) => <span className="tabular-nums">{formatMinutes(m.today.categories.break)}</span> },
    { key: 'away', header: 'Away / IT', render: (m) => <span className="tabular-nums">{formatMinutes(m.today.categories.inactive + m.today.categories.system)}</span> },
    { key: 'checkIn', header: 'Checked in', render: (m) => (m.checkIn ? formatTime(m.checkIn) : '—') },
  ];

  const counts = data?.counts || {};

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Live Status"
        subtitle="Who is doing what right now, and how today is going. Updates every 30 seconds."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={refetch}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 empty:hidden">
        {isHR && (
          <Select
            className="w-64"
            placeholder="All employees"
            options={(managers.data || []).map((m) => ({ value: m._id, label: `Team of ${getFullName(m)}` }))}
            value={manager}
            onChange={(e) => setManager(e.target.value)}
          />
        )}
        <TeamScopeToggle {...teamScope} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[...WORK_CATEGORY_KEYS, 'offline'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter((f) => (f === key ? '' : key))}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
              filter === key ? WORK_CATEGORIES[key].soft : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              filter === key && 'ring-2 ring-offset-1 ring-slate-200'
            )}
          >
            <span className={clsx('h-2.5 w-2.5 rounded-full', WORK_CATEGORIES[key].dot)} />
            {WORK_CATEGORIES[key].label}
            <span className="font-semibold">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <ErrorMessage message={error} onRetry={refetch} />
      <Card noPadding>
        <DataTable
          columns={columns}
          rows={members}
          loading={loading && !data}
          rowKey={(m) => m.user._id}
          onRowClick={setSelected}
          emptyMessage={filter ? 'Nobody in this state right now' : 'No team members'}
        />
      </Card>
      <p className="mt-2 text-xs text-slate-400">Click a person to see their full day. Breaks longer than 30 minutes are shown in red.</p>

      <PersonDayModal member={selected} onClose={() => setSelected(null)} />
    </RoleGuard>
  );
}
