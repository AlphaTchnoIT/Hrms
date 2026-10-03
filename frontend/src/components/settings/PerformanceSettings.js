'use client';

import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { Button, Card, FormSection, Input } from '@/components/ui';

/*
 * KPI targets, rating weights and status thresholds. Saved separately from the main settings form.
 */
export default function PerformanceSettings({ settings }) {
  const form = useForm({
    kpiTargets: { ...settings.kpiTargets },
    kpiWeights: { ...settings.kpiWeights },
    attentionBand: settings.attentionBand,
    efficiencyGlidePath: settings.efficiencyGlidePath || [],
    shortLoginPercent: settings.shortLoginPercent,
    idleAlertMinutes: settings.idleAlertMinutes,
    calibrationTolerance: settings.calibrationTolerance,
  });
  const { register, values, setField } = form;
  const num = (v) => Number(v);
  const weightTotal = num(values.kpiWeights.quality) + num(values.kpiWeights.efficiency) + num(values.kpiWeights.classification);

  const onSubmit = form.handleSubmit(async (data) => {
    const mapNums = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, num(v)]));
    const res = await api.put('/settings', {
      kpiTargets: mapNums(data.kpiTargets),
      kpiWeights: mapNums(data.kpiWeights),
      attentionBand: num(data.attentionBand),
      efficiencyGlidePath: data.efficiencyGlidePath.map((s) => ({ week: num(s.week), target: num(s.target) })),
      shortLoginPercent: num(data.shortLoginPercent),
      idleAlertMinutes: num(data.idleAlertMinutes),
      calibrationTolerance: num(data.calibrationTolerance),
    });
    toast.success(res.message);
  });

  const setStep = (index, key, value) => setField('efficiencyGlidePath', values.efficiencyGlidePath.map((s, i) => (i === index ? { ...s, [key]: value } : s)));

  return (
    <form onSubmit={onSubmit} noValidate className="mb-6">
      <Card title="Performance rules" subtitle="KPI targets, rating weights and the thresholds for Meeting Target / Needs Attention / Critical">
        <FormSection title="KPI targets (%)" description="An employee meets target when the score is at or above it.">
          <Input label="Quality (QA)" type="number" min="0" max="100" {...register('kpiTargets.quality')} />
          <Input label="Efficiency" type="number" min="0" max="100" {...register('kpiTargets.efficiency')} />
          <Input label="Classification" type="number" min="0" max="100" {...register('kpiTargets.classification')} />
          <Input label="Shift adherence" type="number" min="0" max="100" {...register('kpiTargets.adherence')} />
          <Input
            label="Needs attention band"
            type="number"
            min="1"
            max="50"
            hint={`Up to ${values.attentionBand} points below target = Needs Attention; further below = Critical`}
            {...register('attentionBand')}
          />
        </FormSection>

        <FormSection title="3-parameter rating weights (%)" description="Used for the composite score and the 1–5 rating. Must add up to 100.">
          <Input label="Quality" type="number" min="0" max="100" {...register('kpiWeights.quality')} />
          <Input label="Efficiency" type="number" min="0" max="100" {...register('kpiWeights.efficiency')} />
          <Input label="Classification" type="number" min="0" max="100" {...register('kpiWeights.classification')} />
          <p className={`self-end pb-2 text-sm font-medium ${weightTotal === 100 ? 'text-emerald-600' : 'text-red-600'}`}>Total: {weightTotal}%</p>
        </FormSection>

        <FormSection title="Efficiency glide path" description="Ramp-up targets for new joiners by weeks of tenure. After the last step the normal target applies.">
          <div className="space-y-2 sm:col-span-2">
            {values.efficiencyGlidePath.map((step, index) => (
              <div key={index} className="flex items-end gap-2">
                <Input label={index === 0 ? 'Up to week' : undefined} type="number" min="1" className="w-32" value={step.week} onChange={(e) => setStep(index, 'week', e.target.value)} />
                <Input label={index === 0 ? 'Target %' : undefined} type="number" min="0" max="100" className="w-32" value={step.target} onChange={(e) => setStep(index, 'target', e.target.value)} />
                <Button variant="ghost" icon={Trash2} label="Remove step" onClick={() => setField('efficiencyGlidePath', values.efficiencyGlidePath.filter((_, i) => i !== index))} />
              </div>
            ))}
            <Button
              variant="link"
              size="sm"
              icon={Plus}
              onClick={() => {
                const last = values.efficiencyGlidePath[values.efficiencyGlidePath.length - 1];
                setField('efficiencyGlidePath', [...values.efficiencyGlidePath, { week: num(last?.week || 0) + 4, target: Math.min(100, num(last?.target || 60) + 5) }]);
              }}
            >
              Add step
            </Button>
          </div>
        </FormSection>

        <FormSection title="Login & calibration" description="Short logins, idle-time alerts and calibration alignment.">
          <Input label="Short login below (% of shift)" type="number" min="50" max="100" {...register('shortLoginPercent')} />
          <Input label="Idle alert above (minutes / day)" type="number" min="0" {...register('idleAlertMinutes')} />
          <Input label="Calibration tolerance (points)" type="number" min="0" max="50" hint="Manager vs QA difference counted as aligned" {...register('calibrationTolerance')} />
        </FormSection>
        <div className="flex justify-end">
          <Button type="submit" loading={form.submitting}>
            Save performance rules
          </Button>
        </div>
      </Card>
    </form>
  );
}
