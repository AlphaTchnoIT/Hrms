'use client';

import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import clsx from 'clsx';
import api from '@/lib/api';
import { getFullName } from '@/lib/format';
import { Avatar, Spinner } from '@/components/ui';
import { sameId } from './chatUtils';

/*
 * Search active employees by name / email / code.
 *   Single:   <PeoplePicker onPick={(person) => ...} />
 *   Multiple: <PeoplePicker selected={people} onChange={setPeople} />
 * excludeIds hides people (yourself, existing group members).
 */
export default function PeoplePicker({ onPick, selected, onChange, excludeIds = [], autoFocus = true }) {
  const multiple = Boolean(onChange);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const excludeKey = excludeIds.map(String).join(',');

  // Small delay so typing a name doesn't send a request per key
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/employees/directory', { params: { search: search.trim() || undefined, limit: 30 } });
        const excluded = new Set(excludeKey.split(','));
        if (!cancelled) setPeople(res.data.filter((p) => !excluded.has(String(p._id))));
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, excludeKey]);

  const isSelected = (person) => multiple && selected.some((p) => sameId(p, person));
  const toggle = (person) => {
    if (!multiple) return onPick(person);
    return onChange(isSelected(person) ? selected.filter((p) => !sameId(p, person)) : [...selected, person]);
  };

  return (
    <div>
      {multiple && selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <span key={person._id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand-700">
              {getFullName(person)}
              <button type="button" onClick={() => toggle(person)} aria-label={`Remove ${getFullName(person)}`} className="rounded-full p-0.5 hover:bg-brand-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus={autoFocus}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or employee code"
          className="form-control pl-9"
        />
      </div>

      <div className="mt-2 max-h-72 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {!loading && !people.length && <p className="py-6 text-center text-sm text-slate-500">No one found</p>}
        {!loading &&
          people.map((person) => (
            <button
              key={person._id}
              type="button"
              onClick={() => toggle(person)}
              className={clsx('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50', isSelected(person) && 'bg-brand-50/60')}
            >
              <Avatar name={getFullName(person)} src={person.avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{getFullName(person)}</p>
                <p className="truncate text-xs text-slate-500">{person.designation?.title || person.email}</p>
              </div>
              {isSelected(person) && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
      </div>
    </div>
  );
}
