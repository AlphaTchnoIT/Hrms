'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Info } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { applyLeaveSchema } from '@/lib/validation';
import { Button, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui';

const EMPTY = { leaveType: '', fromDate: '', toDate: '', isHalfDay: false, halfDaySession: 'first-half', reason: '' };

// Rough count of Mon-Fri days for the preview (server makes the final count incl. holidays)
function countWeekdays(from, to) {
  if (!from || !to || to < from) return 0;
  let count = 0;
  const date = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (date <= end) {
    if (![0, 6].includes(date.getDay())) count += 1;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

export default function ApplyLeaveModal({ open, onClose, balances = [], onApplied }) {
  const form = useForm(EMPTY, { schema: applyLeaveSchema });
  const { values } = form;

  useEffect(() => {
    if (open) form.reset(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = balances.find((b) => b.leaveType._id === values.leaveType);
  const days = values.isHalfDay ? (values.fromDate ? 0.5 : 0) : countWeekdays(values.fromDate, values.toDate);
  const exceedsBalance = selected?.leaveType.isPaid && days > selected.available;

  const options = balances.map((b) => ({
    value: b.leaveType._id,
    label: b.leaveType.isPaid ? `${b.leaveType.name} — ${b.available} day(s) left` : `${b.leaveType.name} (unpaid)`,
  }));

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = { ...data, toDate: data.isHalfDay ? data.fromDate : data.toDate };
    const res = await api.post('/leaves', payload);
    toast.success(res.message);
    onApplied?.();
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      description="Your reporting manager will be notified."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="apply-leave-form" loading={form.submitting} disabled={exceedsBalance}>
            Apply leave
          </Button>
        </>
      }
    >
      <form id="apply-leave-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Select label="Leave type" required options={options} {...form.register('leaveType')} />

        {selected?.leaveType.allowHalfDay !== false && (
          <Checkbox label="Half day" description="Apply for half of a single day" {...form.register('isHalfDay', { type: 'checkbox' })} />
        )}

        {values.isHalfDay ? (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date" type="date" required {...form.register('fromDate')} />
            <Select label="Session" placeholder={false} options={['first-half', 'second-half']} {...form.register('halfDaySession')} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input label="From" type="date" required {...form.register('fromDate')} />
            <Input label="To" type="date" required min={values.fromDate} {...form.register('toDate')} />
          </div>
        )}

        {days > 0 && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
              exceedsBalance ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-800'
            }`}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              About <strong>{days}</strong> working day(s).{' '}
              {exceedsBalance
                ? `You only have ${selected.available} day(s) of ${selected.leaveType.name} left.`
                : 'Holidays in between are not counted.'}
            </span>
          </div>
        )}

        <Textarea label="Reason" required maxLength={500} placeholder="Briefly explain the reason" {...form.register('reason')} />
      </form>
    </Modal>
  );
}
