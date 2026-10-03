'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { Card, Select } from '@/components/ui';

const QUARTERS = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];

// Leave taken per type, summed per quarter. Pass userId to see a team member's summary.
export default function QuarterlyLeaveSummary({ userId }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const { data, loading } = useFetch('/leaves/quarterly-summary', { params: { year, user: userId || undefined } });

  return (
    <Card
      title="Leave taken by quarter"
      subtitle="Approved leave days per leave type"
      action={
        <Select
          className="w-28"
          placeholder={false}
          options={[thisYear, thisYear - 1, thisYear - 2].map(String)}
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      }
      noPadding
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Leave type</th>
              {QUARTERS.map((q) => (
                <th key={q} className="px-4 py-3 text-right">
                  {q}
                </th>
              ))}
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && (
              <tr>
                <td colSpan={6} className="px-5 py-4 text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {data && !data.types.length && (
              <tr>
                <td colSpan={6} className="px-5 py-4 text-slate-500">
                  No approved leave in {year}
                </td>
              </tr>
            )}
            {data?.types.map((t) => (
              <tr key={t.leaveType?._id}>
                <td className="px-5 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.leaveType?.color }} />
                    {t.leaveType?.name}
                  </span>
                </td>
                {t.quarters.map((d, i) => (
                  <td key={i} className="px-4 py-2.5 text-right">
                    {d || '—'}
                  </td>
                ))}
                <td className="px-5 py-2.5 text-right font-semibold">{t.total}</td>
              </tr>
            ))}
            {data?.types.length > 0 && (
              <tr className="bg-slate-50 font-semibold">
                <td className="px-5 py-2.5">All leave</td>
                {data.quarters.map((d, i) => (
                  <td key={i} className="px-4 py-2.5 text-right">
                    {d}
                  </td>
                ))}
                <td className="px-5 py-2.5 text-right">{data.total}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
