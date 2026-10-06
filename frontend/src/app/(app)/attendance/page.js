'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarPlus, CalendarRange } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { formatDate, formatDay, formatTime, minutesToHours, zonedParts } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, Skeleton, Tabs, useConfirm } from '@/components/ui';
import MonthYearPicker from '@/components/shared/MonthYearPicker';
import CheckInCard from '@/components/attendance/CheckInCard';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';
import RegularizationModal from '@/components/attendance/RegularizationModal';

export default function AttendancePage() {
  const confirm = useConfirm();
  const now = zonedParts();
  const [period, setPeriod] = useState({ month: now.month, year: now.year });
  const [tab, setTab] = useState('calendar');
  const [regularizeDate, setRegularizeDate] = useState(null);

  const attendance = useFetch('/attendance/my', { params: period });
  const requests = useFetch('/attendance/regularizations/my');
  const pendingCount = (requests.data || []).filter((r) => r.status === 'pending').length;

  const cancelRequest = async (request) => {
    const ok = await confirm({
      title: 'Cancel this request?',
      message: `Your regularisation request for ${formatDate(request.date)} will be withdrawn.`,
      confirmText: 'Cancel request',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.patch(`/attendance/regularizations/${request._id}/cancel`);
      toast.success('Request cancelled');
      requests.refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Show only days up to today in the log, newest first
  const logRows = (attendance.data?.days || []).filter((d) => !['upcoming', 'not-employed'].includes(d.status)).reverse();

  const logColumns = [
    { key: 'date', header: 'Date', render: (d) => <span className="font-medium text-slate-800">{formatDay(d.date)}</span> },
    { key: 'status', header: 'Status', render: (d) => <Badge status={d.status === 'today' ? (d.record ? 'checked-in' : 'not-checked-in') : d.status} /> },
    { key: 'in', header: 'Check in', render: (d) => (d.record?.checkIn?.time ? formatTime(d.record.checkIn.time) : '—') },
    {
      key: 'out',
      header: 'Check out',
      render: (d) =>
        d.record?.checkOut?.time ? formatTime(d.record.checkOut.time) : d.record && d.status !== 'today' ? <span className="text-amber-600">Missing</span> : '—',
    },
    { key: 'hours', header: 'Work hours', render: (d) => (d.record?.checkOut?.time ? minutesToHours(d.record.workMinutes) : '—') },
    { key: 'late', header: 'Late by', render: (d) => (d.record?.isLate ? <span className="text-orange-600">{d.record.lateByMinutes} min</span> : '—') },
    {
      key: 'note',
      header: 'Remarks',
      render: (d) => <span className="text-slate-500">{d.holiday || d.leave?.leaveType?.name || (d.record?.source === 'regularization' ? 'Regularised' : '')}</span>,
    },
  ];

  const requestColumns = [
    { key: 'date', header: 'Date', render: (r) => <span className="font-medium text-slate-800">{formatDate(r.date)}</span> },
    { key: 'time', header: 'Requested time', render: (r) => `${r.checkInTime} – ${r.checkOutTime}` },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-xs truncate" title={r.reason}>{r.reason}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'note', header: 'Reviewer note', render: (r) => <span className="text-slate-500">{r.reviewNote || '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.status === 'pending' && (
          <Button size="sm" variant="ghost" onClick={() => cancelRequest(r)}>
            Cancel
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Check in from the web, review your month and fix missed punches."
        actions={
          <Button icon={CalendarPlus} variant="secondary" onClick={() => setRegularizeDate('')}>
            Regularise
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <CheckInCard onChange={attendance.refetch} />
        </div>
        <div className="lg:col-span-3">
          {attendance.loading && !attendance.data ? (
            <Skeleton className="h-full min-h-48 rounded-2xl" />
          ) : (
            <AttendanceSummary summary={attendance.data?.summary} />
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'list', label: 'Attendance log' },
            { value: 'requests', label: 'Regularisations', count: pendingCount || undefined },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab !== 'requests' && <MonthYearPicker month={period.month} year={period.year} onChange={setPeriod} />}
      </div>

      <div className="mt-4">
        <ErrorMessage message={attendance.error} onRetry={attendance.refetch} />

        {tab === 'calendar' && (
          <Card>
            {attendance.loading && !attendance.data ? (
              <Skeleton className="h-96 rounded-xl" />
            ) : (
              <AttendanceCalendar days={attendance.data?.days} onDayClick={(day) => setRegularizeDate(day.date)} />
            )}
          </Card>
        )}

        {tab === 'list' && (
          <Card noPadding>
            <DataTable columns={logColumns} rows={logRows} loading={attendance.loading} rowKey="date" />
          </Card>
        )}

        {tab === 'requests' && (
          <Card noPadding>
            <DataTable
              columns={requestColumns}
              rows={requests.data}
              loading={requests.loading}
              emptyIcon={CalendarRange}
              emptyTitle="No regularisation requests"
              emptyMessage="Missed a check-in? Click a day on the calendar to request a correction."
            />
          </Card>
        )}
      </div>

      <RegularizationModal
        open={regularizeDate !== null}
        defaultDate={regularizeDate}
        onClose={() => setRegularizeDate(null)}
        onSaved={() => {
          requests.refetch();
          setTab('requests');
        }}
      />
    </div>
  );
}
