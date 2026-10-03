'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardPen, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useTabParam } from '@/hooks/useTabParam';
import { APPROVER_ROLES } from '@/lib/constants';
import { getFullName } from '@/lib/format';
import { Button, Card, DataTable, ErrorMessage, PageHeader, PageLoader, Select, StatCard, Tabs } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';
import KpiEntryModal from '@/components/performance/KpiEntryModal';
import { AdherenceTrendChart, KpiTrendChart, PerformanceStatus, RatingStars, StatusBreakdown } from '@/components/performance/KpiWidgets';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function ScoreCell({ metric }) {
  if (!metric || metric.score === null || metric.score === undefined) return <span className="text-slate-400">—</span>;
  const tone = { 'meeting-target': 'text-emerald-600', 'needs-attention': 'text-amber-600', critical: 'text-rose-600' }[metric.status];
  return (
    <span className={`font-semibold ${tone || ''}`} title={`Target ${metric.target}%`}>
      {metric.score}%
    </span>
  );
}

function ManagerRatingsTab() {
  const { data, loading } = useFetch('/performance/manager-ratings');
  const columns = [
    { key: 'manager', header: 'Manager', render: (r) => <EmployeeCell employee={r.manager} /> },
    { key: 'team', header: 'Team', render: (r) => r.teamSize },
    { key: 'quality', header: 'Quality', render: (r) => pct(r.averages.quality) },
    { key: 'efficiency', header: 'Efficiency', render: (r) => pct(r.averages.efficiency) },
    { key: 'classification', header: 'Classification', render: (r) => pct(r.averages.classification) },
    { key: 'adherence', header: 'Adherence', render: (r) => pct(r.averages.adherence) },
    { key: 'achievement', header: 'Achievement', render: (r) => (r.teamAchievement === null ? '—' : `${Math.round(r.teamAchievement * 100)}%`) },
    { key: 'rating', header: 'Manager rating', render: (r) => <RatingStars value={r.rating} /> },
    { key: 'status', header: 'Team status', render: (r) => `${r.statusCounts.critical} critical · ${r.statusCounts['needs-attention']} attention` },
  ];
  return (
    <Card noPadding title="Manager rating by team performance" subtitle="Average achievement of each manager's direct reports against KPI targets (last 30 days)">
      <DataTable columns={columns} rows={data} loading={loading} rowKey={(r) => r.manager._id} emptyMessage="No managers with team members" />
    </Card>
  );
}

export default function TeamPerformancePage() {
  const { isHR } = useAuth();
  const [tab, setTab] = useTabParam('team', ['team', 'managers']);
  const [manager, setManager] = useState('');
  const [days, setDays] = useState('30');
  const [entryOpen, setEntryOpen] = useState(false);

  const managers = useFetch(isHR ? '/employees/directory' : null, { params: { role: 'manager', limit: 200 } });
  const { data, loading, error, refetch } = useFetch(tab === 'team' ? '/performance/team' : null, { params: { manager: manager || undefined, days } });
  const members = data?.members || [];

  const columns = [
    { key: 'employee', header: 'Employee', render: (m) => <EmployeeCell employee={m.user} subtitle={m.user.designation?.title} /> },
    { key: 'quality', header: 'Quality', render: (m) => <ScoreCell metric={m.metrics.quality} /> },
    { key: 'efficiency', header: 'Efficiency', render: (m) => <ScoreCell metric={m.metrics.efficiency} /> },
    { key: 'classification', header: 'Classification', render: (m) => <ScoreCell metric={m.metrics.classification} /> },
    { key: 'adherence', header: 'Adherence', render: (m) => <ScoreCell metric={m.metrics.adherence} /> },
    { key: 'logins', header: 'Late / short', render: (m) => `${m.metrics.adherence.lateLogins} / ${m.metrics.adherence.shortLogins}` },
    { key: 'composite', header: 'Composite', render: (m) => m.compositeScore ?? '—' },
    { key: 'rating', header: 'Rating', render: (m) => <RatingStars value={m.rating} /> },
    { key: 'status', header: 'Status', render: (m) => <PerformanceStatus status={m.status} /> },
    {
      key: 'view',
      header: '',
      render: (m) => (
        <Link href={`/team/performance/${m.user._id}`} className="text-xs font-medium text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  const avg = (metric) => {
    const list = members.map((m) => m.metrics[metric].score).filter((s) => s !== null && s !== undefined);
    return list.length ? `${Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10}%` : '—';
  };

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Team Performance"
        subtitle="KPIs, attendance, QA, efficiency, classification, adherence and performance trends"
        actions={
          <Button icon={ClipboardPen} onClick={() => setEntryOpen(true)}>
            Record KPI results
          </Button>
        }
      />

      {isHR && (
        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'team', label: 'Team dashboard' },
            { value: 'managers', label: 'Manager ratings' },
          ]}
        />
      )}

      {tab === 'managers' && isHR ? (
        <ManagerRatingsTab />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            {isHR && (
              <Select
                className="w-64"
                placeholder="All employees"
                options={(managers.data || []).map((m) => ({ value: m._id, label: `Team of ${getFullName(m)}` }))}
                value={manager}
                onChange={(e) => setManager(e.target.value)}
              />
            )}
            <Select
              className="w-44"
              placeholder={false}
              options={[
                { value: '30', label: 'Last 30 days' },
                { value: '60', label: 'Last 60 days' },
                { value: '90', label: 'Last 90 days' },
              ]}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>

          <ErrorMessage message={error} onRetry={refetch} />
          {loading && !data && <PageLoader />}
          {data && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Team members" value={members.length} icon={Users} />
                <StatCard label="Avg quality" value={avg('quality')} tone="purple" />
                <StatCard label="Avg efficiency" value={avg('efficiency')} tone="green" />
                <StatCard label="Avg classification" value={avg('classification')} tone="yellow" />
                <StatCard label="Avg adherence" value={avg('adherence')} tone="blue" />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Performance status" className="lg:col-span-2">
                  <StatusBreakdown counts={data.statusCounts} />
                </Card>
                <Card title="Manager rating" subtitle="Based on the team's KPI achievement">
                  {data.managerRating ? (
                    <div>
                      <RatingStars value={data.managerRating.rating} size="lg" showLabel />
                      <p className="mt-2 text-sm text-slate-600">
                        Team achievement{' '}
                        <strong>{data.managerRating.teamAchievement !== null ? `${Math.round(data.managerRating.teamAchievement * 100)}%` : '—'}</strong> of target
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Select a manager's team to see their rating.</p>
                  )}
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card title="Team KPI trend" subtitle="Weekly team average, last 13 weeks">
                  <KpiTrendChart data={data.trend} />
                </Card>
                <Card title="Attendance & shift adherence" subtitle="Last 3 months">
                  <AdherenceTrendChart data={data.adherenceTrend} target={data.targets?.adherence} />
                </Card>
              </div>

              <Card noPadding title="Team members" subtitle={`${data.range.from} → ${data.range.to}`}>
                <DataTable columns={columns} rows={members} rowKey={(m) => m.user._id} emptyMessage="No team members" />
              </Card>
            </div>
          )}
        </>
      )}

      <KpiEntryModal open={entryOpen} onClose={() => setEntryOpen(false)} members={members.map((m) => m.user)} onSaved={refetch} />
    </RoleGuard>
  );
}
