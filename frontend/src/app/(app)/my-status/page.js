'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { toInputDate } from '@/lib/format';
import { WORK_STATUS_UPDATED_EVENT } from '@/lib/workStatus';
import { Card, ErrorMessage, Input, PageHeader, PageLoader } from '@/components/ui';
import DayTimeline from '@/components/workStatus/DayTimeline';

// The logged-in employee's own Live Work Status history, one day at a time
export default function MyStatusPage() {
  const [date, setDate] = useState(toInputDate());
  const { data, loading, error, refetch } = useFetch('/work-status/day', { params: { date } });

  // Refresh when the status is changed from the top bar
  useEffect(() => {
    window.addEventListener(WORK_STATUS_UPDATED_EVENT, refetch);
    return () => window.removeEventListener(WORK_STATUS_UPDATED_EVENT, refetch);
  }, [refetch]);

  return (
    <div>
      <PageHeader
        title="My Work Status"
        subtitle="How your day was spent. Change your status from the button at the top of the page."
        actions={<Input type="date" value={date} max={toInputDate()} onChange={(e) => setDate(e.target.value)} />}
      />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data ? <PageLoader /> : data && <Card><DayTimeline day={data} /></Card>}
    </div>
  );
}
