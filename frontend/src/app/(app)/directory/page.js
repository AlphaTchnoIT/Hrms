'use client';

import { useEffect, useState } from 'react';
import { Mail, Phone, Search } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { getFullName } from '@/lib/format';
import { Avatar, EmptyState, PageHeader, PageLoader, Select } from '@/components/ui';

export default function DirectoryPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const departments = useFetch('/departments');
  const { data, loading } = useFetch('/employees/directory', {
    params: { search: query, department: department || undefined, limit: 200 },
  });

  return (
    <div>
      <PageHeader title="Employee Directory" subtitle="Find and contact your colleagues" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className="form-control pl-9" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          className="sm:w-56"
          placeholder="All departments"
          options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>

      {loading && !data && <PageLoader />}
      {!loading && !data?.length && <EmptyState message="No employees found" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(data || []).map((person) => (
          <div key={person._id} className="card flex flex-col items-center p-5 text-center">
            <Avatar name={getFullName(person)} src={person.avatar} size="lg" />
            <p className="mt-3 font-semibold text-slate-800">{getFullName(person)}</p>
            <p className="text-sm text-slate-500">{person.designation?.title || '—'}</p>
            <p className="text-xs text-slate-400">{person.department?.name}</p>
            <div className="mt-4 w-full space-y-1 border-t border-slate-100 pt-3 text-left text-xs text-slate-600">
              <a href={`mailto:${person.email}`} className="flex items-center gap-2 truncate hover:text-brand-600">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {person.email}
              </a>
              {person.phone && (
                <a href={`tel:${person.phone}`} className="flex items-center gap-2 hover:text-brand-600">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {person.phone}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
