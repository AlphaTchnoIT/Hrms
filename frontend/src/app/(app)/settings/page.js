'use client';

import toast from 'react-hot-toast';
import clsx from 'clsx';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { settingsSchema } from '@/lib/validation';
import { ROLES, WEEK_DAYS } from '@/lib/constants';
import { Button, Card, Checkbox, FormSection, Input, PageHeader, PageLoader, Textarea } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import PerformanceSettings from '@/components/settings/PerformanceSettings';

function SettingsForm({ settings }) {
  const form = useForm(
    {
      companyName: settings.companyName || '',
      companyEmail: settings.companyEmail || '',
      companyPhone: settings.companyPhone || '',
      companyAddress: settings.companyAddress || '',
      timezone: settings.timezone || 'Asia/Kolkata',
      currency: settings.currency || 'INR',
      officeStartTime: settings.officeStartTime,
      officeEndTime: settings.officeEndTime,
      graceMinutes: settings.graceMinutes,
      halfDayMinutes: settings.halfDayMinutes,
      fullDayMinutes: settings.fullDayMinutes,
      weeklyOffs: settings.weeklyOffs || [],
      requireLocationForCheckIn: settings.requireLocationForCheckIn,
      pfRate: settings.pfRate,
      pfCeiling: settings.pfCeiling,
      professionalTax: settings.professionalTax,
      attendanceBasedLop: settings.attendanceBasedLop,
    },
    { schema: settingsSchema }
  );
  const { register, values, setField } = form;

  const toggleWeeklyOff = (day) => {
    const current = values.weeklyOffs;
    setField('weeklyOffs', current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort());
  };

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.put('/settings', data);
    toast.success(res.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="pb-24">
      <Card>
        <FormSection title="Company" description="Shown on payslips and across the app.">
          <Input label="Company name" required className="sm:col-span-2" {...register('companyName')} />
          <Input label="Email" type="email" {...register('companyEmail')} />
          <Input label="Phone" {...register('companyPhone')} />
          <Textarea label="Address" rows={2} className="sm:col-span-2" maxLength={300} {...register('companyAddress')} />
          <Input label="Timezone" required hint="IANA name, e.g. Asia/Kolkata" {...register('timezone')} />
        </FormSection>

        <FormSection title="Shift & attendance" description="Used to mark late check-ins and present / half-day / absent.">
          <Input label="Office start time" type="time" required {...register('officeStartTime')} />
          <Input label="Office end time" type="time" required {...register('officeEndTime')} />
          <Input label="Grace period" type="number" min="0" max="120" required hint="Minutes after start before 'Late'" {...register('graceMinutes')} />
          <div />
          <Input label="Full day (minutes)" type="number" required hint="Work at least this for Present" {...register('fullDayMinutes')} />
          <Input label="Half day (minutes)" type="number" required hint="Below this is marked Absent" {...register('halfDayMinutes')} />
          <div className="sm:col-span-2">
            <p className="form-label">Weekly offs</p>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((day, index) => {
                const selected = values.weeklyOffs.includes(index);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeeklyOff(index)}
                    className={clsx(
                      'h-9 rounded-lg border px-3 text-sm font-medium transition',
                      selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    )}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            {form.errors.weeklyOffs && <p className="mt-1.5 text-xs font-medium text-red-600">{form.errors.weeklyOffs}</p>}
          </div>
          <Checkbox
            className="sm:col-span-2"
            label="Require browser location for web check-in"
            description="Employees must allow location access to check in or out"
            {...register('requireLocationForCheckIn', { type: 'checkbox' })}
          />
        </FormSection>

        <FormSection title="Payroll" description="Statutory deductions applied when running payroll.">
          <Input label="Employee PF rate" type="number" min="0" max="100" step="0.01" required hint="% of basic" {...register('pfRate')} />
          <Input label="PF monthly cap" type="number" min="0" prefix="₹" required hint="0 = no cap" {...register('pfCeiling')} />
          <Input label="Professional tax" type="number" min="0" prefix="₹" required hint="Per month" {...register('professionalTax')} />
          <div />
          <Checkbox
            className="sm:col-span-2"
            label="Deduct salary for absent days"
            description="Loss of pay is calculated from attendance. Unpaid leave is always deducted."
            {...register('attendanceBasedLop', { type: 'checkbox' })}
          />
        </FormSection>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] justify-end px-4 py-3 sm:px-6 lg:px-8">
          <Button type="submit" loading={form.submitting}>
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { data, loading } = useFetch('/settings');

  return (
    <RoleGuard roles={[ROLES.ADMIN]}>
      <PageHeader title="Settings" subtitle="Performance rules, company profile, attendance rules and payroll configuration." />
      {loading || !data ? (
        <PageLoader />
      ) : (
        <>
          <PerformanceSettings settings={data} />
          <SettingsForm settings={data} />
        </>
      )}
    </RoleGuard>
  );
}
