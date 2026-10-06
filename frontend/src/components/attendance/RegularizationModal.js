'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { regularizationSchema } from '@/lib/validation';
import { toInputDate } from '@/lib/format';
import { Button, Input, Modal, Textarea } from '@/components/ui';

const EMPTY = { date: '', checkInTime: '09:00', checkOutTime: '17:30', reason: '' };

// Request to fix a missed or wrong punch
export default function RegularizationModal({ open, onClose, defaultDate, onSaved }) {
  const form = useForm(EMPTY, { schema: regularizationSchema });

  useEffect(() => {
    if (open) form.reset({ ...EMPTY, date: defaultDate || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/attendance/regularizations', data);
    toast.success(res.message);
    onSaved?.();
    onClose();
  });

  const minDate = toInputDate(new Date(Date.now() - 30 * 86400000));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Regularize attendance"
      description="Fix a missed or incorrect punch. Your manager will review it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="regularization-form" loading={form.submitting}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="regularization-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="Date"
          type="date"
          required
          min={minDate}
          max={toInputDate()}
          hint="Allowed for the last 30 days"
          {...form.register('date')}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Check-in time" type="time" required {...form.register('checkInTime')} />
          <Input label="Check-out time" type="time" required {...form.register('checkOutTime')} />
        </div>
        <Textarea
          label="Reason"
          required
          maxLength={300}
          placeholder="e.g. Forgot to check out after a client meeting"
          {...form.register('reason')}
        />
      </form>
    </Modal>
  );
}
