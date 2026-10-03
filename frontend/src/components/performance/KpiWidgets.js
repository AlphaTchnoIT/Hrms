'use client';

import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus, Star } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { METRIC_COLORS, METRIC_LABELS, RATING_LABELS } from '@/lib/constants';
import { formatDate, MONTHS } from '@/lib/format';
import { Badge } from '@/components/ui';

const BAR_COLORS = { 'meeting-target': 'bg-emerald-500', 'needs-attention': 'bg-amber-500', critical: 'bg-rose-500' };
const shortDate = (d) => formatDate(d, { day: '2-digit', month: 'short' });
const monthLabel = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3)} ${m.slice(2, 4)}`;

export function PerformanceStatus({ status }) {
  return <Badge status={status || 'no-data'} />;
}

export function RatingStars({ value, size = 'sm', showLabel = false }) {
  if (!value) return <span className="text-xs text-slate-400">Not rated</span>;
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={clsx(cls, n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        ))}
      </span>
      {showLabel && <span className="text-xs font-medium text-slate-600">{RATING_LABELS[value]}</span>}
    </span>
  );
}

// Change versus the previous period
export function Delta({ current, previous, suffix = '' }) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className={clsx('inline-flex items-center text-xs font-medium', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500')}>
      <Icon className="h-3.5 w-3.5" />
      {diff > 0 ? '+' : ''}
      {diff}
      {suffix}
    </span>
  );
}

// One KPI: score vs target with status colour
export function ScoreTile({ metric, data, previous, hint }) {
  const score = data?.score;
  const pct = score === null || score === undefined ? 0 : Math.min(100, score);
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500">{METRIC_LABELS[metric]}</p>
        <PerformanceStatus status={data?.status} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight text-slate-900">{score === null || score === undefined ? '—' : `${score}%`}</p>
        <Delta current={score} previous={previous?.score} />
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx('h-full rounded-full', BAR_COLORS[data?.status] || 'bg-slate-300')} style={{ width: `${pct}%` }} />
        {data?.target ? <span className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: `${Math.min(100, data.target)}%` }} title={`Target ${data.target}%`} /> : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Target {data?.target ?? '—'}%{hint ? ` · ${hint}` : ''}
      </p>
    </div>
  );
}

// Weekly KPI trend lines
export function KpiTrendChart({ data = [], metrics = ['quality', 'efficiency', 'classification'], targets, height = 280 }) {
  const chartData = data.map((d) => ({ ...d, label: shortDate(d.week) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => (v === null ? '—' : `${v}%`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {metrics.map((metric) => (
          <Line key={metric} type="monotone" dataKey={metric} name={METRIC_LABELS[metric]} stroke={METRIC_COLORS[metric]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
        ))}
        {targets && metrics.length === 1 && <ReferenceLine y={targets[metrics[0]]} stroke="#334155" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 11, fill: '#334155' }} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Monthly attendance / adherence % with late & short login counts
export function AdherenceTrendChart({ data = [], target, height = 260 }) {
  const chartData = data.map((m) => ({ ...m, label: monthLabel(m.month) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: '#f1f5f9' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="pct" dataKey="attendancePercent" name="Attendance %" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="pct" dataKey="adherencePercent" name="Adherence %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="count" dataKey="lateLogins" name="Late logins" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="count" dataKey="shortLogins" name="Short logins" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        {target && <ReferenceLine yAxisId="pct" y={target} stroke="#334155" strokeDasharray="4 4" />}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Forward performance of an action plan: weekly score vs baseline and target
export function PlanProgressChart({ progress, targetScore, height = 180 }) {
  const data = (progress?.points || []).map((p) => ({ ...p, label: shortDate(p.week) }));
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-500">No scores recorded since the plan started yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis domain={['dataMin - 5', 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v}%`} />
        <Line type="monotone" dataKey="score" name="Score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        {progress.baselineScore !== null && <ReferenceLine y={progress.baselineScore} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Baseline', fontSize: 10, fill: '#64748b', position: 'insideBottomLeft' }} />}
        <ReferenceLine y={targetScore} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 10, fill: '#059669', position: 'insideTopLeft' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Small horizontal stacked bar of status counts
export function StatusBreakdown({ counts }) {
  const items = [
    { key: 'meeting-target', label: 'Meeting target', color: 'bg-emerald-500' },
    { key: 'needs-attention', label: 'Needs attention', color: 'bg-amber-500' },
    { key: 'critical', label: 'Critical', color: 'bg-rose-500' },
    { key: 'no-data', label: 'No data', color: 'bg-slate-300' },
  ];
  const total = items.reduce((s, i) => s + (counts?.[i.key] || 0), 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {items.map((i) => (counts?.[i.key] ? <div key={i.key} className={i.color} style={{ width: `${(counts[i.key] / total) * 100}%` }} /> : null))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {items.map((i) => (
          <span key={i.key} className="inline-flex items-center gap-1.5">
            <span className={clsx('h-2 w-2 rounded-full', i.color)} /> {i.label}: <strong>{counts?.[i.key] || 0}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
