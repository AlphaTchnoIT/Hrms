'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { goalSchema, teamGoalSchema } from '@/lib/validation';
import { GOAL_STATUS } from '@/lib/constants';
import { getFullName } from '@/lib/format';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';

const RATINGS = [1, 2, 3, 4, 5].map((r) => ({ value: String(r), label: `${r} – ${['Needs improvement', 'Fair', 'Good', 'Very good', 'Excellent'][r - 1]}` }));

function toValues(goal) {
  return {
    user: goal?.user?._id || '',
    title: goal?.title || '',
    description: goal?.description || '',
    startDate: goal?.startDate || '',
    dueDate: goal?.dueDate || '',
    weightage: goal?.weightage ?? '',
    progress: goal?.progress ?? 0,
    status: goal?.status || 'not-started',
    selfRating: goal?.selfRating ? String(goal.selfRating) : '',
    selfComment: goal?.selfComment || '',
    managerRating: goal?.managerRating ? String(goal.managerRating) : '',
    managerComment: goal?.managerComment || '',
  };
}

/*
 * mode = 'self'    -> employee editing own goal (self review fields)
 * mode = 'manager' -> manager creating / reviewing a team member's goal
 */
export default function GoalFormModal({ open, onClose, goal, mode = 'self', teamMembers = [], onSaved }) {
  const isManager = mode === 'manager';
  const form = useForm(toValues(goal), { schema: isManager && !goal ? teamGoalSchema : goalSchema });
  const { register, values } = form;

  useEffect(() => {
    if (open) form.reset(toValues(goal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = { ...data };
    if (!isManager || goal) delete payload.user;
    if (isManager) {
      delete payload.selfRating;
      delete payload.selfComment;
    }
    const res = goal ? await api.put(`/goals/${goal._id}`, payload) : await api.post('/goals', payload);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={goal ? 'Update goal' : isManager ? 'Assign a goal' : 'New goal'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="goal-form" loading={form.submitting}>
            Save goal
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {isManager && !goal && (
          <Select label="Employee" required options={teamMembers.map((m) => ({ value: m._id, label: getFullName(m) }))} {...register('user')} />
        )}
        <Input label="Goal title" required placeholder="e.g. Reduce API response time by 30%" {...register('title')} />
        <Textarea label="Description" maxLength={1000} placeholder="How will success be measured?" {...register('description')} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Start date" type="date" {...register('startDate')} />
          <Input label="Due date" type="date" min={values.startDate || undefined} {...register('dueDate')} />
          <Input label="Weightage (%)" type="number" min="0" max="100" {...register('weightage')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">
              Progress <span className="font-semibold text-brand-600">{values.progress}%</span>
            </label>
            <input type="range" min="0" max="100" step="5" {...register('progress')} className="mt-2 w-full accent-brand-600" />
          </div>
          <Select label="Status" placeholder={false} options={GOAL_STATUS} {...register('status')} />
        </div>

        {goal && (
          <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
            <p className="text-sm font-semibold text-slate-800 sm:col-span-2">Self review</p>
            <Select label="Self rating" placeholder="Not rated" options={RATINGS} disabled={isManager} {...register('selfRating')} />
            <Textarea label="Self comment" rows={2} disabled={isManager} {...register('selfComment')} />
          </div>
        )}

        {goal && isManager && (
          <div className="grid gap-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:grid-cols-2">
            <p className="text-sm font-semibold text-slate-800 sm:col-span-2">Manager review</p>
            <Select label="Manager rating" placeholder="Not rated" options={RATINGS} {...register('managerRating')} />
            <Textarea label="Manager comment" rows={2} {...register('managerComment')} />
          </div>
        )}
      </form>
    </Modal>
  );
}
