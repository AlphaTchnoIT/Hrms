'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { KPI_METRICS, METRIC_LABELS } from '@/lib/constants';
import { getFullName, toInputDate } from '@/lib/format';
import { Avatar, Button, Input, Modal, Select } from '@/components/ui';

/*
 * Record daily / weekly KPI results for many employees at once.
 * Managers record efficiency & classification; quality comes from QA audits (QA / HR may enter it).
 */
export default function KpiEntryModal({ open, onClose, members = [], onSaved }) {
  const { user } = useAuth();
  const metrics = user?.role === 'manager' ? KPI_METRICS.filter((m) => m !== 'quality') : KPI_METRICS;
  const [metric, setMetric] = useState(metrics[0]);
  const [period, setPeriod] = useState('daily');
  const [date, setDate] = useState(toInputDate());
  const [scores, setScores] = useState({});
  const [remarks, setRemarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setScores({});
    setRemarks({});
    setErrors({});
    setDate(toInputDate());
  }, [open]);

  const submit = async () => {
    const entries = members
      .filter((m) => scores[m._id] !== undefined && scores[m._id] !== '')
      .map((m) => ({ user: m._id, metric, period, date, score: Number(scores[m._id]), remarks: remarks[m._id] || '' }));
    if (!entries.length) return toast.error('Enter at least one score');
    setSaving(true);
    try {
      const res = await api.post('/performance/kpis/bulk', { entries });
      toast.success(res.message);
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Record KPI results"
      description="Enter scores (0-100) for the people you want to update. Leave others blank."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Save results
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="KPI" placeholder={false} options={metrics.map((m) => ({ value: m, label: METRIC_LABELS[m] }))} value={metric} onChange={(e) => setMetric(e.target.value)} />
        <Select label="Period" placeholder={false} options={['daily', 'weekly']} value={period} onChange={(e) => setPeriod(e.target.value)} />
        <Input label={period === 'weekly' ? 'Any day of the week' : 'Date'} type="date" max={toInputDate()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {members.map((m, index) => (
          <div key={m._id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar name={getFullName(m)} size="sm" />
              <span className="truncate text-sm font-medium text-slate-800">{getFullName(m)}</span>
            </div>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Score"
              aria-label={`Score for ${getFullName(m)}`}
              className="form-control sm:w-28"
              value={scores[m._id] ?? ''}
              onChange={(e) => setScores((s) => ({ ...s, [m._id]: e.target.value }))}
            />
            <input
              placeholder="Remarks"
              aria-label={`Remarks for ${getFullName(m)}`}
              className="form-control sm:w-56"
              value={remarks[m._id] ?? ''}
              onChange={(e) => setRemarks((s) => ({ ...s, [m._id]: e.target.value }))}
            />
            {Object.keys(errors).some((k) => k.startsWith(`entries.${index}`)) && (
              <p className="text-xs text-red-600">{Object.entries(errors).find(([k]) => k.startsWith(`entries.${index}`))[1]}</p>
            )}
          </div>
        ))}
        {!members.length && <p className="p-4 text-sm text-slate-500">No team members</p>}
      </div>
    </Modal>
  );
}
