'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { leaveTypeSchema } from '@/lib/validation';
import { HR_ROLES } from '@/lib/constants';
import { Badge, Button, Card, Checkbox, DataTable, Input, Modal, PageHeader, Select, Textarea, useConfirm } from '@/components/ui';
import { STATUTORY_PAY_OPTIONS } from '@/lib/constants';
import RoleGuard from '@/components/layout/RoleGuard';

const COLORS = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'];

function LeaveTypeModal({ item, onClose, onSaved }) {
  const form = useForm(
    {
      name: item?.name || '',
      code: item?.code || '',
      annualQuota: item?.annualQuota ?? '',
      isPaid: item?.isPaid ?? true,
      allowHalfDay: item?.allowHalfDay ?? true,
      proRata: item?.proRata ?? false,
      carryForwardMax: item?.carryForwardMax ?? 0,
      statutoryPay: item?.statutoryPay || 'none',
      color: item?.color || COLORS[0],
      description: item?.description || '',
      isActive: item?.isActive ?? true,
    },
    { schema: leaveTypeSchema }
  );
  const { register, values, setField } = form;

  const onSubmit = form.handleSubmit(async (data) => {
    const res = item ? await api.put(`/leaves/types/${item._id}`, data) : await api.post('/leaves/types', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Edit leave type' : 'New leave type'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="leave-type-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="leave-type-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Name" required className="col-span-2" placeholder="e.g. Annual Leave" {...register('name')} />
          <Input label="Code" required placeholder="AL" maxLength={6} {...register('code')} />
        </div>
        <Input
          label="Days per year"
          type="number"
          min="0"
          step="0.5"
          required={values.isPaid}
          disabled={!values.isPaid}
          hint={item ? "Changing this recalculates everyone's balance for this year" : 'Full-time, full-year entitlement'}
          {...register('annualQuota')}
        />
        <Select
          label="Statutory pay"
          placeholder={false}
          options={STATUTORY_PAY_OPTIONS}
          hint="Leave paid through payroll as SSP / SMP / SPP instead of salary. Untick Paid leave for these."
          {...register('statutoryPay')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox label="Pro-rata" description="Part-time (working days ÷ 5) and joiners / leavers get a share" {...register('proRata', { type: 'checkbox' })} />
          <Input label="Carry over to next year" type="number" min="0" max="60" step="0.5" hint="Max unused days that move into next year" {...register('carryForwardMax')} />
        </div>
        <div>
          <label className="form-label">Colour</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Colour ${color}`}
                onClick={() => setField('color', color)}
                className={`h-8 w-8 rounded-full ring-offset-2 transition ${values.color === color ? 'ring-2 ring-slate-900' : 'hover:scale-110'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <Textarea label="Description" maxLength={300} {...register('description')} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Checkbox label="Paid leave" description="Unpaid days reduce pay" {...register('isPaid', { type: 'checkbox' })} />
          <Checkbox label="Allow half day" {...register('allowHalfDay', { type: 'checkbox' })} />
          <Checkbox label="Active" {...register('isActive', { type: 'checkbox' })} />
        </div>
      </form>
    </Modal>
  );
}

export default function LeaveTypesPage() {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(undefined);
  const { data, loading, refetch } = useFetch('/leaves/types', { params: { all: 'true' } });

  const remove = async (item) => {
    const ok = await confirm({
      title: `Delete ${item.name}?`,
      message: 'If employees have already used this leave type, it will be deactivated instead of deleted.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/leaves/types/${item._id}`);
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Leave type',
      render: (t) => (
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
          <div>
            <p className="font-medium text-slate-800">{t.name}</p>
            {t.description && <p className="max-w-xs truncate text-xs text-slate-500">{t.description}</p>}
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (t) => <span className="font-mono text-xs">{t.code}</span> },
    { key: 'quota', header: 'Days / year', render: (t) => (t.isPaid ? t.annualQuota : 'Unlimited') },
    { key: 'paid', header: 'Type', render: (t) => <Badge color={t.isPaid ? 'green' : 'gray'}>{t.isPaid ? 'Paid' : 'Unpaid'}</Badge> },
    { key: 'half', header: 'Half day', render: (t) => (t.allowHalfDay ? 'Allowed' : 'No') },
    { key: 'status', header: 'Status', render: (t) => <Badge status={t.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" icon={Pencil} label="Edit" onClick={() => setEditing(t)} />
          <Button size="sm" variant="ghost" icon={Trash2} label="Delete" onClick={() => remove(t)} />
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Leave Policies"
        subtitle="Configure leave types and yearly quotas."
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            Add leave type
          </Button>
        }
      />
      <Card noPadding>
        <DataTable columns={columns} rows={data} loading={loading} />
      </Card>
      {editing !== undefined && <LeaveTypeModal item={editing} onClose={() => setEditing(undefined)} onSaved={refetch} />}
    </RoleGuard>
  );
}
