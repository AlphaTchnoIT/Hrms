'use client';

import toast from 'react-hot-toast';
import { Award, Gauge, Users } from 'lucide-react';
import api from '@/lib/api';
import { ALL_METRICS, METRIC_LABELS, RATING_LABELS } from '@/lib/constants';
import { formatDate, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, DataTable } from '@/components/ui';
import { AdherenceTrendChart, Delta, KpiTrendChart, PerformanceStatus, RatingStars, ScoreTile } from './KpiWidgets';

/*
 * KPI dashboard of one employee: current (last 30 days) vs previous period,
 * weekly trends, 3-month adherence, recent results and monthly ratings.
 * data = response of GET /performance/my or /performance/employee/:id
 */
export default function PerformanceDashboard({ data, mode = 'self', onRefetch }) {
  const current = data.current || {};
  const previous = data.previous || {};
  const metrics = current.metrics || {};

  const acknowledgeRating = async (rating) => {
    try {
      const res = await api.patch(`/performance/ratings/${rating._id}/acknowledge`);
      toast.success(res.message);
      onRefetch?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const kpiColumns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'metric', header: 'KPI', render: (r) => METRIC_LABELS[r.metric] },
    { key: 'period', header: 'Period', render: (r) => titleCase(r.period) },
    {
      key: 'score',
      header: 'Score',
      render: (r) => <span className={r.score >= (r.target ?? 0) ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{r.score}%</span>,
    },
    { key: 'target', header: 'Target', render: (r) => (r.target !== undefined ? `${r.target}%` : '—') },
    { key: 'source', header: 'Source', render: (r) => (r.source === 'qa-audit' ? 'QA audits' : r.recordedBy ? getFullName(r.recordedBy) : 'Manual') },
    { key: 'remarks', header: 'Remarks', render: (r) => r.remarks || '—' },
  ];

  const adherence = metrics.adherence || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-slate-500">Performance status (last 30 days)</p>
            <Gauge className="h-5 w-5 text-brand-500" />
          </div>
          <div className="mt-3">
            <PerformanceStatus status={current.status} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Based on {Object.values(metrics).filter((m) => m.status).length} KPI(s). The lowest KPI decides the status.
          </p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-slate-500">3-parameter rating</p>
            <Award className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-slate-900">{current.compositeScore ?? '—'}</p>
            <span className="text-xs text-slate-500">composite score</span>
            <Delta current={current.compositeScore} previous={previous.compositeScore} />
          </div>
          <div className="mt-2">
            <RatingStars value={current.rating} showLabel />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Quality {data.weights?.quality}% · Efficiency {data.weights?.efficiency}% · Classification {data.weights?.classification}%
          </p>
        </div>
        {data.managerRating ? (
          <div className="card p-5">
            <div className="flex items-start justify-between">
              <p className="text-[13px] font-medium text-slate-500">My rating as a manager</p>
              <Users className="h-5 w-5 text-sky-500" />
            </div>
            <div className="mt-2">
              <RatingStars value={data.managerRating.rating} showLabel />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Team of {data.managerRating.teamSize} at{' '}
              <strong>{data.managerRating.teamAchievement !== null ? `${Math.round(data.managerRating.teamAchievement * 100)}%` : '—'}</strong> of target
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.managerRating.statusCounts.critical} critical · {data.managerRating.statusCounts['needs-attention']} need attention
            </p>
          </div>
        ) : (
          <div className="card p-5">
            <p className="text-[13px] font-medium text-slate-500">Shift adherence</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{adherence.score ?? '—'}%</p>
            <p className="mt-2 text-xs text-slate-500">
              {adherence.lateLogins} late · {adherence.shortLogins} short logins · {adherence.absent} absent (30 days)
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ALL_METRICS.map((metric) => (
          <ScoreTile
            key={metric}
            metric={metric}
            data={metrics[metric]}
            previous={previous.metrics?.[metric]}
            hint={
              metric === 'adherence'
                ? `${adherence.lateLogins || 0} late, ${adherence.shortLogins || 0} short`
                : metrics[metric]?.records
                  ? `${metrics[metric].records} results, ${metrics[metric].belowTarget} below target`
                  : 'no results yet'
            }
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="KPI trend" subtitle="Weekly average, last 13 weeks">
          <KpiTrendChart data={data.trend} />
        </Card>
        <Card title="Shift adherence trend" subtitle="Attendance, login and adherence — last 3 months">
          <AdherenceTrendChart data={data.adherenceTrend} target={data.targets?.adherence} />
        </Card>
      </div>

      {data.ratings?.length > 0 && (
        <Card title="Monthly ratings" subtitle={mode === 'self' ? 'Approved by HR and QA' : 'Including ratings waiting for approval'}>
          <div className="divide-y divide-slate-100">
            {data.ratings.map((r) => (
              <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-800">{r.period}</p>
                  <p className="text-xs text-slate-500">
                    Quality {r.scores?.quality ?? '—'}% · Efficiency {r.scores?.efficiency ?? '—'}% · Classification {r.scores?.classification ?? '—'}%
                  </p>
                  {r.managerComment && <p className="mt-1 text-xs italic text-slate-600">“{r.managerComment}”</p>}
                </div>
                <div className="flex items-center gap-3">
                  <RatingStars value={r.finalRating} />
                  <span className="text-xs text-slate-600">{RATING_LABELS[r.finalRating]}</span>
                  {mode !== 'self' && <Badge status={r.status} />}
                  {mode === 'self' &&
                    (r.employeeAcknowledgedAt ? (
                      <span className="text-xs text-emerald-600">Acknowledged</span>
                    ) : (
                      <Button size="xs" onClick={() => acknowledgeRating(r)}>
                        Acknowledge
                      </Button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Recent KPI results" noPadding>
        <DataTable columns={kpiColumns} rows={data.recentKpis} emptyMessage="No KPI results recorded yet" />
      </Card>
    </div>
  );
}
