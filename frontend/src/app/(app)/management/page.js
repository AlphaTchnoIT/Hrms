'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Briefcase, Gauge, HeartHandshake, Headphones, ListChecks, Scale, ShieldAlert, UserMinus, Users } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { HR_ROLES } from '@/lib/constants';
import { MONTHS } from '@/lib/format';
import { Card, DataTable, ErrorMessage, PageHeader, PageLoader, StatCard } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';
import { AdherenceTrendChart, KpiTrendChart, RatingStars, StatusBreakdown } from '@/components/performance/KpiWidgets';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

export default function ManagementDashboardPage() {
  const { data, loading, error, refetch } = useFetch('/reports/management');

  const teamColumns = [
    { key: 'manager', header: 'Team (manager)', render: (t) => <EmployeeCell employee={t.manager} /> },
    { key: 'size', header: 'Size', render: (t) => t.teamSize },
    { key: 'quality', header: 'Quality', render: (t) => pct(t.averages.quality) },
    { key: 'efficiency', header: 'Efficiency', render: (t) => pct(t.averages.efficiency) },
    { key: 'classification', header: 'Classification', render: (t) => pct(t.averages.classification) },
    { key: 'adherence', header: 'Adherence', render: (t) => pct(t.averages.adherence) },
    { key: 'critical', header: 'Critical / attention', render: (t) => `${t.statusCounts.critical} / ${t.statusCounts['needs-attention']}` },
    { key: 'rating', header: 'Manager rating', render: (t) => <RatingStars value={t.rating} /> },
  ];
  const deptColumns = [
    { key: 'name', header: 'Department', render: (d) => <strong>{d.name}</strong> },
    { key: 'headcount', header: 'Headcount', render: (d) => d.headcount },
    { key: 'composite', header: 'Avg composite', render: (d) => d.composite ?? '—' },
    { key: 'critical', header: 'Critical', render: (d) => d.critical },
    { key: 'attention', header: 'Needs attention', render: (d) => d.attention },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader title="Management Dashboard" subtitle="Organisation-level trends: attendance, KPI achievement, QA, productivity, attrition and teams requiring attention" />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Headcount" value={data.headcount} hint={`${data.joinersLastYear} joined in 12 months`} icon={Users} />
            <StatCard label="Attrition (12 months)" value={`${data.attritionRate}%`} hint={`${data.exitsLastYear} exits`} icon={UserMinus} tone="red" />
            <StatCard label="KPI achievement" value={pct(data.kpiAchievementPercent)} hint="Employees meeting all targets" icon={Gauge} tone="green" />
            <StatCard label="Teams requiring attention" value={data.teamsRequiringAttention.length} icon={AlertTriangle} tone="yellow" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {['quality', 'efficiency', 'classification', 'adherence'].map((m) => (
              <StatCard key={m} label={`Avg ${m}`} value={pct(data.averages[m])} hint={`Target ${data.targets?.[m]}%`} tone={data.averages[m] >= data.targets?.[m] ? 'green' : 'red'} />
            ))}
          </div>

          <Card title="Performance status across the organisation">
            <StatusBreakdown counts={data.statusCounts} />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="QA, productivity & classification" subtitle="Weekly organisation average">
              <KpiTrendChart data={data.kpiTrend} />
            </Card>
            <Card title="Attendance & adherence" subtitle="Last 6 months">
              <AdherenceTrendChart data={data.attendanceTrend} target={data.targets?.adherence} />
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="Attrition trend" subtitle="Exits per month">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.attritionTrend.map((a) => ({ ...a, label: MONTHS[Number(a.month.slice(5)) - 1].slice(0, 3) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="exits" name="Exits" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Open items" className="xl:col-span-2">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Open escalations" value={data.open.escalations} icon={Scale} href="/relations" />
                <StatCard label="Active warnings" value={data.open.activeWarnings} icon={ShieldAlert} tone="red" href="/relations?tab=warnings" />
                <StatCard label="Open action plans" value={data.open.actionPlans} icon={ListChecks} tone="blue" href="/team/action-plans" />
                <StatCard label="Open IT tickets" value={data.open.tickets} icon={Headphones} tone="gray" />
                <StatCard label="Open grievances" value={data.open.grievances} icon={HeartHandshake} tone="purple" href="/support?tab=grievances" />
                <StatCard label="Open jobs" value={data.open.jobs} icon={Briefcase} tone="green" href="/recruitment" />
              </div>
            </Card>
          </div>

          <Card noPadding title="Teams requiring attention" subtitle="Teams with critical / needs-attention members or a manager rating of 2 or less">
            <DataTable columns={teamColumns} rows={data.teamsRequiringAttention} rowKey={(t) => t.manager._id} emptyMessage="All teams are on track" />
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card noPadding title="All teams">
              <DataTable columns={teamColumns.filter((c) => !['classification', 'quality'].includes(c.key))} rows={data.teams} rowKey={(t) => t.manager._id} />
            </Card>
            <Card noPadding title="Departments">
              <DataTable columns={deptColumns} rows={data.departments} rowKey="name" />
            </Card>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
