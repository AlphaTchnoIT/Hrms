'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { getCurrencySymbol } from '@/lib/format';
import { Button, Card, FormSection, Input } from '@/components/ui';

const AMOUNT_FIELDS = [
  ['personalAllowance', 'Personal allowance', 'Per year, for tax code 1257L'],
  ['niPrimaryThreshold', 'NI primary threshold', 'Employee NI starts above this (per year)'],
  ['niUpperEarningsLimit', 'NI upper earnings limit', 'Employee NI drops to the upper rate above this'],
  ['niSecondaryThreshold', 'Employer NI threshold', 'Employer NI starts above this (per year)'],
  ['pensionLowerLimit', 'Pension: lower limit', 'Qualifying earnings start here (per year)'],
  ['pensionUpperLimit', 'Pension: upper limit', 'Qualifying earnings stop here (per year)'],
];
const RATE_FIELDS = [
  ['niMainRate', 'Employee NI main rate'],
  ['niUpperRate', 'Employee NI upper rate'],
  ['niEmployerRate', 'Employer NI rate'],
  ['pensionEmployeeRate', 'Employee pension'],
  ['pensionEmployerRate', 'Employer pension'],
  ['studentLoanRate', 'Student loan rate'],
  ['postgradLoanRate', 'Postgraduate loan rate'],
];
const LOAN_PLANS = [
  ['plan1', 'Plan 1'],
  ['plan2', 'Plan 2'],
  ['plan4', 'Plan 4'],
  ['plan5', 'Plan 5'],
  ['postgrad', 'Postgraduate'],
];

// Editable tax bands: band width above the personal allowance + rate; the last band has no limit
function BandEditor({ title, bands, onChange }) {
  const update = (index, key, value) => onChange(bands.map((b, i) => (i === index ? { ...b, [key]: value } : b)));
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {bands.map((band, index) => {
        const last = index === bands.length - 1;
        return (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <Input
              label={index === 0 ? 'Band width (taxable income above allowance)' : undefined}
              type="number"
              min="0"
              className="w-72"
              prefix={getCurrencySymbol()}
              disabled={last}
              placeholder={last ? 'No upper limit' : ''}
              value={last ? '' : band.upTo ?? ''}
              onChange={(e) => update(index, 'upTo', e.target.value)}
            />
            <Input label={index === 0 ? 'Rate %' : undefined} type="number" min="0" max="100" className="w-28" value={band.rate} onChange={(e) => update(index, 'rate', e.target.value)} />
            <Button variant="ghost" icon={Trash2} label="Remove band" disabled={bands.length <= 1} onClick={() => onChange(bands.filter((_, i) => i !== index))} />
          </div>
        );
      })}
      <Button variant="link" size="sm" icon={Plus} onClick={() => onChange([...bands.slice(0, -1), { upTo: '', rate: '' }, bands[bands.length - 1]])}>
        Add band
      </Button>
    </div>
  );
}

/*
 * UK PAYE rates used by payroll: Income Tax bands (incl. Scotland), National Insurance,
 * workplace pension and student loans. Check and update them every April for the new tax year.
 */
export default function UkPayrollSettings({ settings }) {
  const [rates, setRates] = useState(() => structuredClone(settings.payroll || {}));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key, value) => setRates((r) => ({ ...r, [key]: value }));
  const setLoan = (key, value) => setRates((r) => ({ ...r, studentLoanThresholds: { ...r.studentLoanThresholds, [key]: value } }));

  const save = async () => {
    const num = (v) => Number(v);
    const bands = (list) => list.map((b, i) => ({ upTo: i === list.length - 1 ? null : num(b.upTo), rate: num(b.rate) }));
    const payload = {
      ...Object.fromEntries([...AMOUNT_FIELDS, ...RATE_FIELDS].map(([key]) => [key, num(rates[key])])),
      taxYear: rates.taxYear,
      taxBands: bands(rates.taxBands),
      scottishTaxBands: bands(rates.scottishTaxBands),
      studentLoanThresholds: Object.fromEntries(LOAN_PLANS.map(([key]) => [key, num(rates.studentLoanThresholds?.[key])])),
    };
    setSaving(true);
    setErrors({});
    try {
      await api.put('/settings', { payroll: payload });
      toast.success('UK payroll rates saved');
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const err = (key) => errors[`payroll.${key}`];

  return (
    <Card className="mb-6" title="UK payroll rates" subtitle="Income Tax (PAYE), National Insurance, workplace pension and student loans. Update these every April for the new tax year.">
      <FormSection title="Tax year" description="Shown for reference.">
        <Input label="Tax year" placeholder="2026/27" value={rates.taxYear || ''} error={err('taxYear')} onChange={(e) => set('taxYear', e.target.value)} />
      </FormSection>

      <FormSection title="Income Tax bands" description="England, Wales & Northern Ireland, and Scottish bands (tax codes starting with S).">
        <BandEditor title="England, Wales & NI" bands={rates.taxBands || []} onChange={(v) => set('taxBands', v)} />
        <BandEditor title="Scotland" bands={rates.scottishTaxBands || []} onChange={(v) => set('scottishTaxBands', v)} />
        {(err('taxBands') || err('scottishTaxBands')) && <p className="text-xs font-medium text-red-600 sm:col-span-2">{err('taxBands') || err('scottishTaxBands')}</p>}
      </FormSection>

      <FormSection title="Thresholds" description="Annual amounts.">
        {AMOUNT_FIELDS.map(([key, label, hint]) => (
          <Input key={key} label={label} hint={hint} type="number" min="0" prefix={getCurrencySymbol()} value={rates[key] ?? ''} error={err(key)} onChange={(e) => set(key, e.target.value)} />
        ))}
      </FormSection>

      <FormSection title="Rates (%)" description="National Insurance, pension and loan repayment rates.">
        {RATE_FIELDS.map(([key, label]) => (
          <Input key={key} label={label} type="number" min="0" max="100" step="0.01" value={rates[key] ?? ''} error={err(key)} onChange={(e) => set(key, e.target.value)} />
        ))}
      </FormSection>

      <FormSection title="Student loan thresholds" description="Annual repayment thresholds per plan.">
        {LOAN_PLANS.map(([key, label]) => (
          <Input key={key} label={label} type="number" min="0" prefix={getCurrencySymbol()} value={rates.studentLoanThresholds?.[key] ?? ''} onChange={(e) => setLoan(key, e.target.value)} />
        ))}
      </FormSection>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save UK payroll rates
        </Button>
      </div>
    </Card>
  );
}
