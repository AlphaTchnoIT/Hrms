'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from '@/hooks/useForm';
import { reviewSchema } from '@/lib/validation';
import { Button, Modal, Textarea } from '@/components/ui';

/*
 * Approve / reject dialog used for leaves, regularizations and expenses.
 * A reason is mandatory when rejecting.
 *   <ReviewModal open action="approve" onSubmit={async (note) => ...} onClose={...}>details</ReviewModal>
 * onSubmit should throw on failure so the error is shown in the form.
 */
export default function ReviewModal({ open, action, title, children, onSubmit, onClose }) {
  const isApprove = action === 'approve';
  const schema = useMemo(() => reviewSchema(action), [action]);
  const form = useForm({ note: '' }, { schema });

  useEffect(() => {
    if (open) form.reset({ note: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action]);

  const handleSubmit = form.handleSubmit(async ({ note }) => onSubmit(note));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (isApprove ? 'Approve request' : 'Reject request')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="review-form" variant={isApprove ? 'success' : 'danger'} loading={form.submitting}>
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <form id="review-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {children}
        <Textarea
          label={isApprove ? 'Note (optional)' : 'Reason for rejection'}
          required={!isApprove}
          maxLength={500}
          placeholder={isApprove ? 'Add a note for the employee' : 'Explain why so the employee can act on it'}
          {...form.register('note')}
        />
      </form>
    </Modal>
  );
}
