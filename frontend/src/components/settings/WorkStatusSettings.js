'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { WORK_CATEGORIES, WORK_CATEGORY_KEYS } from '@/lib/workStatus';
import { Button, Card, Checkbox, Input, Select } from '@/components/ui';

const CATEGORY_OPTIONS = WORK_CATEGORY_KEYS.map((key) => ({ value: key, label: WORK_CATEGORIES[key].label }));

// "Chat support" -> "chat-support" (kept unique)
function makeKey(label, taken) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'status';
  let key = base;
  for (let i = 2; taken.includes(key); i += 1) key = `${base}-${i}`;
  return key;
}

/*
 * Live Work Status options: name, category (decides productive vs break etc.) and on/off.
 * Statuses are switched off rather than deleted so old timelines keep their meaning.
 */
export default function WorkStatusSettings({ settings }) {
  const [statuses, setStatuses] = useState(() => (settings.workStatuses || []).map((s) => ({ ...s, active: s.active !== false })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (index, changes) => setStatuses((list) => list.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  const addStatus = () => setStatuses((list) => [...list, { key: '', label: '', category: 'productive', active: true, isNew: true }]);

  const save = async () => {
    setError('');
    if (statuses.some((s) => !s.label.trim())) {
      setError('Every status needs a name');
      return;
    }
    const taken = statuses.filter((s) => !s.isNew).map((s) => s.key);
    const payload = statuses.map((s) => {
      if (!s.isNew) return { key: s.key, label: s.label.trim(), category: s.category, active: s.active };
      const key = makeKey(s.label, taken);
      taken.push(key);
      return { key, label: s.label.trim(), category: s.category, active: s.active };
    });

    setSaving(true);
    try {
      const res = await api.put('/settings', { workStatuses: payload });
      setStatuses(res.data.workStatuses.map((s) => ({ ...s, active: s.active !== false })));
      toast.success('Work statuses saved');
    } catch (err) {
      setError(err.errors?.workStatuses || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6" title="Live Work Status" subtitle="The statuses employees pick from the top bar. The category decides whether time counts as productive, break, etc.">
      <div className="space-y-2">
        {statuses.map((status, index) => (
          <div key={status.key || `new-${index}`} className={clsx('flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-2.5', !status.active && 'bg-slate-50 opacity-70')}>
            <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', WORK_CATEGORIES[status.category]?.dot)} />
            <Input className="min-w-[12rem] flex-1" placeholder="Status name" maxLength={40} value={status.label} onChange={(e) => update(index, { label: e.target.value })} />
            <Select className="w-52" placeholder={false} options={CATEGORY_OPTIONS} value={status.category} onChange={(e) => update(index, { category: e.target.value })} />
            <Checkbox label="Active" checked={status.active} onChange={(e) => update(index, { active: e.target.checked })} />
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex items-center justify-between">
        <Button variant="link" size="sm" icon={Plus} onClick={addStatus}>
          Add status
        </Button>
        <Button onClick={save} loading={saving}>
          Save work statuses
        </Button>
      </div>
    </Card>
  );
}
