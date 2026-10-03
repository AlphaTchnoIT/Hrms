'use client';

import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CalendarDays, CheckCircle2, Circle, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { METRIC_LABELS } from '@/lib/constants';
import { formatDate, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Modal, Textarea } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import { PlanProgressChart } from './KpiWidgets';

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx('text-lg font-semibold', tone || 'text-slate-900')}>{value === null || value === undefined ? '—' : `${value}%`}</p>
    </div>
  );
}

/*
 * Action plan with its forward performance (score trend since the plan started).
 * mode = 'employee' (own plan: tick actions, acknowledge) | 'manager' (follow-ups, edit)
 */
export default function ActionPlanCard({ plan, mode = 'employee', onChanged, onCheckIn, onEdit }) {
  const [ackOpen, setAckOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const p = plan.progress || {};
  const isActive = ['open', 'in-progress'].includes(plan.status);

  const toggle = async (action) => {
    try {
      await api.patch(`/action-plans/${plan._id}/actions/${action._id}`, { isDone: !action.isDone });
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const acknowledge = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/action-plans/${plan._id}/acknowledge`, { comment });
      toast.success(res.message);
      setAckOpen(false);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card flex flex-col p-5">
      {mode === 'manager' && plan.user && (
        <div className="mb-3 border-b border-slate-100 pb-3">
          <EmployeeCell employee={plan.user} />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{METRIC_LABELS[plan.metric]}</p>
          <h3 className="mt-0.5 font-semibold text-slate-900">{plan.title}</h3>
          {plan.reason && <p className="mt-1 text-sm text-slate-600">{plan.reason}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge status={plan.status} />
          {p.trajectory && <Badge status={p.trajectory}>{titleCase(p.trajectory)}</Badge>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Baseline" value={p.baselineScore} />
        <Metric label="Latest" value={p.latestScore} tone={p.latestScore >= plan.targetScore ? 'text-emerald-600' : 'text-slate-900'} />
        <Metric label="Target" value={plan.targetScore} tone="text-brand-700" />
      </div>
      {p.improvement !== null && p.improvement !== undefined && (
        <p className={clsx('mt-2 text-xs font-medium', p.improvement >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
          {p.improvement >= 0 ? '+' : ''}
          {p.improvement} points since the plan started · expected today ≈ {p.expectedScore}%
        </p>
      )}

      <div className="mt-3">
        <PlanProgressChart progress={p} targetScore={plan.targetScore} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>
            Actions {p.actionsDone}/{p.actionsTotal}
          </span>
          <span>{p.timeElapsedPercent}% of time used</span>
        </div>
        <ul className="space-y-1.5">
          {plan.actions.map((action) => (
            <li key={action._id}>
              <button
                type="button"
                disabled={!isActive}
                onClick={() => toggle(action)}
                className="flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left text-sm hover:bg-slate-50 disabled:cursor-default"
              >
                {action.isDone ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                <span className={clsx(action.isDone && 'text-slate-400 line-through')}>{action.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {plan.checkIns?.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-ups</p>
          {[...plan.checkIns].reverse().map((c) => (
            <div key={c._id} className="flex gap-2 text-sm">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-slate-700">{c.note}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(c.date)}
                  {c.score !== undefined && c.score !== null ? ` · score ${c.score}%` : ''}
                  {c.by ? ` · ${getFullName(c.by)}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" /> {formatDate(plan.startDate)} → {formatDate(plan.deadline)}
        </span>
        {plan.followUpDate && isActive && <span className={clsx(p.followUpDue && 'font-semibold text-amber-600')}>Follow-up {formatDate(plan.followUpDate)}</span>}
        {p.isOverdue && <Badge status="overdue">Past deadline</Badge>}
        <span>{plan.employeeAcknowledgedAt ? `Acknowledged ${formatDate(plan.employeeAcknowledgedAt)}` : 'Not acknowledged yet'}</span>
      </div>
      {plan.employeeComment && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs italic text-slate-600">Employee: “{plan.employeeComment}”</p>}
      {plan.outcome && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">Outcome: {plan.outcome}</p>}

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        {mode === 'employee' && !plan.employeeAcknowledgedAt && (
          <Button size="sm" onClick={() => setAckOpen(true)}>
            Acknowledge plan
          </Button>
        )}
        {mode === 'manager' && isActive && (
          <>
            <Button size="sm" variant="secondary" onClick={() => onEdit?.(plan)}>
              Update
            </Button>
            <Button size="sm" onClick={() => onCheckIn?.(plan)}>
              Record follow-up
            </Button>
          </>
        )}
      </div>

      <Modal
        open={ackOpen}
        onClose={() => setAckOpen(false)}
        title="Acknowledge action plan"
        description="Confirm you have read and understood the plan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAckOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={acknowledge}>
              Acknowledge
            </Button>
          </>
        }
      >
        <Textarea label="Your comment (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </div>
  );
}
