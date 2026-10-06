'use client';

import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { holidaySchema } from '@/lib/validation';
import { HOLIDAY_REGIONS, HOLIDAY_TYPES } from '@/lib/constants';
import { formatDate, toInputDate } from '@/lib/format';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Textarea, useConfirm } from '@/components/ui';

const TYPE_COLORS = { 'bank-holiday': 'red', regional: 'purple', optional: 'gray', company: 'blue' };

function HolidayModal({ holiday, year, onClose, onSaved }) {
  const form = useForm(
    {
      name: holiday?.name || '',
      date: holiday?.date || '',
      type: holiday?.type || 'bank-holiday',
      description: holiday?.description || '',
      regions: holiday?.regions || [],
    },
    { schema: holidaySchema }
  );
  const toggleRegion = (region) =>
    form.setField('regions', form.values.regions.includes(region) ? form.values.regions.filter((r) => r !== region) : [...form.values.regions, region]);

  const onSubmit = form.handleSubmit(async (data) => {
    const res = holiday ? await api.put(`/holidays/${holiday._id}`, data) : await api.post('/holidays', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={holiday ? 'Edit holiday' : 'Add holiday'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="holiday-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Holiday name" required placeholder="e.g. Christmas Day" {...form.register('name')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" required min={`${year - 1}-01-01`} max={`${year + 1}-12-31`} {...form.register('date')} />
          <Select label="Type" required placeholder={false} options={HOLIDAY_TYPES} {...form.register('type')} />
        </div>
        <div>
          <p className="form-label">Applies to</p>
          <div className="flex flex-wrap gap-4">
            {HOLIDAY_REGIONS.map((r) => (
              <Checkbox key={r.value} label={r.label} checked={form.values.regions.includes(r.value)} onChange={() => toggleRegion(r.value)} />
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Tick none for a UK-wide holiday.</p>
        </div>
        <Textarea label="Description" maxLength={300} {...form.register('description')} />
        <p className="text-xs text-slate-500">Optional holidays are not excluded from working days or leave counts.</p>
      </form>
    </Modal>
  );
}

export default function HolidaysPage() {
  const { isHR, user } = useAuth();
  const confirm = useConfirm();
  const [year, setYear] = useState(new Date().getFullYear());
  // Employees see their own nation's bank holidays by default; HR can look at every region
  const [region, setRegion] = useState(isHR ? '' : user?.holidayRegion || 'england-wales');
  const [editing, setEditing] = useState(undefined);
  const { data: all, loading, refetch } = useFetch('/holidays', { params: { year } });
  const data = all && (region ? all.filter((h) => !h.regions?.length || h.regions.includes(region)) : all);
  const regionLabel = (h) => (h.regions?.length ? h.regions.map((r) => HOLIDAY_REGIONS.find((o) => o.value === r)?.label || r).join(', ') : 'Whole UK');
  const today = toInputDate();
  const nextHoliday = (data || []).find((h) => h.date >= today);

  const remove = async (holiday) => {
    const ok = await confirm({ title: `Delete ${holiday.name}?`, message: 'It will be removed from everyone’s calendar.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/holidays/${holiday._id}`);
      toast.success('Holiday deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Holiday Calendar"
        subtitle={`${data?.length || 0} holidays in ${year}${nextHoliday ? ` · Next: ${nextHoliday.name} on ${formatDate(nextHoliday.date)}` : ''}`}
        actions={
          <>
            <Select className="w-48" placeholder="All UK regions" options={HOLIDAY_REGIONS} value={region} onChange={(e) => setRegion(e.target.value)} />
            <Select
              className="w-28"
              placeholder={false}
              options={[year - 1, year, year + 1].map((y) => ({ value: y, label: String(y) }))}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            {isHR && (
              <Button icon={Plus} onClick={() => setEditing(null)}>
                Add holiday
              </Button>
            )}
          </>
        }
      />

      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && !data?.length && (
        <Card>
          <EmptyState icon={CalendarDays} title="No holidays added" message={`No holidays have been added for ${year} yet.`} />
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data || []).map((h) => {
          const past = h.date < today;
          const isNext = nextHoliday?._id === h._id;
          return (
            <div key={h._id} className={clsx('card flex items-center gap-4 p-4', past && 'opacity-60', isNext && 'border-brand-300 ring-2 ring-brand-100')}>
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
                <span className="text-[10px] font-bold uppercase text-rose-500">{formatDate(h.date, { month: 'short' })}</span>
                <span className="text-xl font-bold leading-none text-slate-900">{h.date.slice(8)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{h.name}</p>
                <p className="text-xs text-slate-500">{formatDate(h.date, { weekday: 'long' })}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge color={TYPE_COLORS[h.type]}>{h.type}</Badge>
                  <span className="text-[11px] text-slate-500">{regionLabel(h)}</span>
                </div>
              </div>
              {isHR && (
                <div className="flex flex-col gap-1">
                  <Button size="xs" variant="ghost" icon={Pencil} label="Edit" onClick={() => setEditing(h)} />
                  <Button size="xs" variant="ghost" icon={Trash2} label="Delete" onClick={() => remove(h)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing !== undefined && <HolidayModal holiday={editing} year={year} onClose={() => setEditing(undefined)} onSaved={refetch} />}
    </div>
  );
}
