'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertTriangle, CalendarCheck, Clock, Siren, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES, METRIC_LABELS, WARNING_STAGES } from '@/lib/constants';
import { formatTime, getFullName } from '@/lib/format';
import { Avatar, Badge, Card, EmptyState, ErrorMessage, PageHeader, PageLoader, Select, StatCard, Tabs } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import { PerformanceStatus, RatingStars } from '@/components/performance/KpiWidgets';

const SEVERITY = { high: 'border-rose-200 bg-rose-50 text-rose-800', medium: 'border-amber-200 bg-amber-50 text-amber-800', low: 'border-slate-200 bg-slate-50 text-slate-700' };

function MemberCard({ member }) {
  const { user, today, metrics } = member;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start gap-3">
        <Avatar name={getFullName(user)} src={user.avatar} />
        <div className="min-w-0 flex-1">
          <Link href={`/team/performance/${user._id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700">
            {getFullName(user)}
          </Link>
          <p className="truncate text-xs text-slate-500">{user.designation?.title || user.employeeCode}</p>
        </div>
        <PerformanceStatus status={member.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {today ? <Badge status={today.status} /> : <Badge status="not-employed">No shift</Badge>}
        {today?.shift && !today.shift.isWeeklyOff && (
          <span>
            {today.shift.shiftName} {today.shift.startTime}–{today.shift.endTime}
          </span>
        )}
        {today?.checkIn && <span>· in {formatTime(today.checkIn)}</span>}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 text-center">
        {['quality', 'efficiency', 'classification', 'adherence'].map((m) => (
          <div key={m} className="rounded-lg bg-slate-50 px-1 py-1.5" title={METRIC_LABELS[m]}>
            <p className="text-[10px] uppercase text-slate-500">{m.slice(0, 4)}</p>
            <p
              className={clsx(
                'text-sm font-semibold',
                metrics[m].status === 'critical' ? 'text-rose-600' : metrics[m].status === 'needs-attention' ? 'text-amber-600' : 'text-slate-800'
              )}
            >
              {metrics[m].score ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <RatingStars value={member.rating} />
        <span>
          {member.warnings.active ? `${member.warnings.active} warning(s)` : 'No warnings'} · {member.actionPlans.open} plan(s)
        </span>
      </div>
    </div>
  );
}

function AttentionList({ members }) {
  const flagged = members.filter((m) => m.reasons.length).sort((a, b) => b.reasons.filter((r) => r.severity === 'high').length - a.reasons.filter((r) => r.severity === 'high').length);
  if (!flagged.length) return <EmptyState icon={CalendarCheck} title="All clear" message="No team member needs intervention right now." />;
  return (
    <div className="space-y-4">
      {flagged.map((m) => (
        <Card key={m.user._id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={getFullName(m.user)} size="sm" />
              <div>
                <p className="font-semibold text-slate-900">{getFullName(m.user)}</p>
                <p className="text-xs text-slate-500">
                  {m.warnings.highestStage ? `Active ${WARNING_STAGES[m.warnings.highestStage].toLowerCase()}` : 'No active warning'} · {m.actionPlans.open} open plan(s)
                </p>
              </div>
            </div>
            <div className="flex gap-2 text-xs font-medium">
              <Link href={`/team/performance/${m.user._id}`} className="text-brand-600 hover:underline">
                Performance
              </Link>
              <Link href="/team/action-plans" className="text-brand-600 hover:underline">
                Action plan
              </Link>
              <Link href={`/relations?employee=${m.user._id}`} className="text-brand-600 hover:underline">
                Escalate / warn
              </Link>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {m.reasons.map((r, i) => (
              <li key={i} className={clsx('flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm', SEVERITY[r.severity])}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export default function TeamHomePage() {
  const { isHR } = useAuth();
  const [tab, setTab] = useState('team');
  const [manager, setManager] = useState('');
  const managers = useFetch(isHR ? '/employees/directory' : null, { params: { role: 'manager', limit: 200 } });
  const { data, loading, error, refetch } = useFetch('/workspace/team', { params: { manager: manager || undefined } });
  const counts = data?.counts || {};

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader title="My Team Home" subtitle="Only the employees currently assigned to your team" />
      {isHR && (
        <Select
          className="mb-4 w-64"
          placeholder="All employees"
          options={(managers.data || []).map((m) => ({ value: m._id, label: `Team of ${getFullName(m)}` }))}
          value={manager}
          onChange={(e) => setManager(e.target.value)}
        />
      )}
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Team members" value={counts.total} icon={Users} />
            <StatCard label="Logged in today" value={`${counts.presentToday ?? 0} / ${counts.total ?? 0}`} hint={`${counts.lateToday ?? 0} late · ${counts.onLeaveToday ?? 0} on leave`} icon={Clock} tone="green" />
            <StatCard label="Critical / needs attention" value={`${counts.critical ?? 0} / ${counts.needsAttention ?? 0}`} icon={Siren} tone="red" />
            <StatCard label="Attention required" value={counts.attentionRequired ?? 0} icon={AlertTriangle} tone="yellow" hint="Declining KPIs, attendance, warnings, overdue actions" />
          </div>
          {data.managerRating && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <span className="font-medium text-slate-700">Manager rating from team performance:</span>
              <RatingStars value={data.managerRating.rating} showLabel />
            </div>
          )}
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'team', label: 'My team', count: counts.total },
              { value: 'attention', label: 'Attention required', count: counts.attentionRequired },
            ]}
          />
          {tab === 'team' ? (
            data.members.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.members.map((m) => (
                  <MemberCard key={m.user._id} member={m} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} message="No employees are assigned to this team." />
            )
          ) : (
            <AttentionList members={data.members} />
          )}
        </>
      )}
    </RoleGuard>
  );
}
