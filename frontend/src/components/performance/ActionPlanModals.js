'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { ACTION_PLAN_STATUS, ALL_METRICS, METRIC_LABELS } from '@/lib/constants';
import { toInputDate } from '@/lib/format';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';

const addDaysStr = (days) => toInputDate(new Date(Date.now() + days * 86400000));

function emptyPlan(userId = '') {
  return {
    user: userId,
    metric: '',
    title: '',
    reason: '',
    targetScore: '',
    startDate: toInputDate(),
    deadline: addDaysStr(30),
    followUpDate: addDaysStr(7),
    actions: [''],
    status: 'open',
    outcome: '',
  };
}

/*
 * Create (with "Generate from KPIs") or update an action plan.
 * plan = existing plan to edit, or null to create
 */
export function ActionPlanFormModal({ open, onClose, plan, memberOptions = [], defaultUser, onSaved }) {
  const form = useForm(emptyPlan(defaultUser));
  const { register, values, setField, setValues } = form;
  const [suggestions, setSuggestions] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSuggestions(null);
    form.reset(
      plan
        ? { ...emptyPlan(), ...plan, user: plan.user?._id || plan.user, followUpDate: plan.followUpDate || '', actions: plan.actions.map((a) => a.description), outcome: plan.outcome || '' }
        : emptyPlan(defaultUser)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan, defaultUser]);

  const generate = async () => {
    if (!values.user) return toast.error('Select an employee first');
    setGenerating(true);
    try {
      const res = await api.post('/action-plans/suggest', { user: values.user });
      setSuggestions(res.data);
      if (!res.data.length) toast.success('This employee is meeting all KPI targets');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const applySuggestion = (s) => {
    setValues((prev) => ({ ...prev, ...s, user: prev.user, actions: s.actions }));
    setSuggestions(null);
  };

  const setAction = (index, text) => setField('actions', values.actions.map((a, i) => (i === index ? text : a)));

  const onSubmit = form.handleSubmit(async (data) => {
    const actions = data.actions.map((a) => a.trim()).filter(Boolean);
    const payload = { ...data, actions, targetScore: Number(data.targetScore) };
    let res;
    if (plan) {
      const { title, reason, targetScore, deadline, followUpDate, status, outcome } = payload;
      res = await api.put(`/action-plans/${plan._id}`, { title, reason, targetScore, deadline, followUpDate, status, outcome, actions });
    } else {
      const { user, metric, title, reason, targetScore, startDate, deadline, followUpDate } = payload;
      res = await api.post('/action-plans', { user, metric, title, reason, targetScore, startDate, deadline, followUpDate, actions });
    }
    toast.success(res.message);
    onSaved?.();
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={plan ? 'Update action plan' : 'New action plan'}
      description="Targeted actions, a target score, deadline and follow-up dates."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={form.submitting}>
            {plan ? 'Save changes' : 'Assign plan'}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {!plan && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select label="Employee" required className="flex-1" options={memberOptions} {...register('user')} />
            <Button variant="secondary" icon={Sparkles} loading={generating} onClick={generate}>
              Generate from KPIs
            </Button>
          </div>
        )}

        {suggestions?.length > 0 && (
          <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
            <p className="text-sm font-medium text-slate-800">KPIs where improvement is required — pick one:</p>
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.metric}
                onClick={() => applySuggestion(s)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-brand-300"
              >
                <span>
                  <strong>{METRIC_LABELS[s.metric]}</strong> — {s.reason}
                </span>
                <span className="text-xs font-medium text-brand-600">Use</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="KPI to improve" required disabled={Boolean(plan)} options={ALL_METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }))} {...register('metric')} />
          <Input label="Target score (%)" type="number" min="0" max="100" required {...register('targetScore')} />
        </div>
        <Input label="Title" required placeholder="e.g. Improve quality from 78% to 90%" {...register('title')} />
        <Textarea label="Reason" rows={2} maxLength={500} {...register('reason')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Start date" type="date" required disabled={Boolean(plan)} {...register('startDate')} />
          <Input label="Deadline" type="date" required {...register('deadline')} />
          <Input label="Follow-up date" type="date" {...register('followUpDate')} />
        </div>

        <div>
          <p className="form-label">
            Actions <span className="text-red-500">*</span>
          </p>
          <div className="space-y-2">
            {values.actions.map((action, index) => (
              <div key={index} className="flex gap-2">
                <input className="form-control" value={action} placeholder={`Action ${index + 1}`} onChange={(e) => setAction(index, e.target.value)} />
                <Button
                  variant="ghost"
                  icon={Trash2}
                  label="Remove action"
                  disabled={values.actions.length === 1}
                  onClick={() => setField('actions', values.actions.filter((_, i) => i !== index))}
                />
              </div>
            ))}
          </div>
          {form.errors.actions && <p className="mt-1.5 text-xs font-medium text-red-600">{form.errors.actions}</p>}
          <Button variant="link" size="sm" icon={Plus} className="mt-1" onClick={() => setField('actions', [...values.actions, ''])}>
            Add action
          </Button>
        </div>

        {plan && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Status" placeholder={false} options={ACTION_PLAN_STATUS} {...register('status')} />
            <Textarea label="Outcome" rows={2} {...register('outcome')} />
          </div>
        )}
      </form>
    </Modal>
  );
}

export function CheckInModal({ open, onClose, plan, onSaved }) {
  const form = useForm({ note: '', score: '', nextFollowUp: '' });

  useEffect(() => {
    if (open) form.reset({ note: '', score: plan?.progress?.latestScore ?? '', nextFollowUp: addDaysStr(7) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post(`/action-plans/${plan._id}/check-ins`, { ...data, score: data.score === '' ? undefined : Number(data.score) });
    toast.success(res.message);
    onSaved?.();
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record follow-up"
      description={plan?.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="checkin-form" loading={form.submitting}>
            Save follow-up
          </Button>
        </>
      }
    >
      <form id="checkin-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Textarea label="Discussion notes" required maxLength={1000} {...form.register('note')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Current score (%)" type="number" min="0" max="100" {...form.register('score')} />
          <Input label="Next follow-up" type="date" {...form.register('nextFollowUp')} />
        </div>
      </form>
    </Modal>
  );
}
