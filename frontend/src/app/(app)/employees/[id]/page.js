'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, Pencil, UserX } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { leaveAllocationSchema, resetPasswordSchema } from '@/lib/validation';
import { Badge, Button, Card, DataTable, ErrorMessage, Input, Modal, PageLoader, Skeleton, Tabs, useConfirm } from '@/components/ui';
import ProfileHeader from '@/components/employees/ProfileHeader';
import ProfileOverview from '@/components/employees/ProfileOverview';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';
import MonthYearPicker from '@/components/shared/MonthYearPicker';
import LeaveDates from '@/components/leave/LeaveDates';
import { zonedParts } from '@/lib/format';

function EmployeeAttendance({ employeeId }) {
  const now = zonedParts();
  const [period, setPeriod] = useState({ month: now.month, year: now.year });
  const { data, loading } = useFetch(`/attendance/employee/${employeeId}`, { params: period });

  return (
    <div className="space-y-4">
      <MonthYearPicker month={period.month} year={period.year} onChange={setPeriod} />
      {loading && !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <>
          <AttendanceSummary summary={data?.summary} />
          <Card>
            <AttendanceCalendar days={data?.days} />
          </Card>
        </>
      )}
    </div>
  );
}

function AdjustBalanceModal({ employeeId, balance, year, onClose, onSaved }) {
  const form = useForm({ allocated: String(balance.allocated) }, { schema: leaveAllocationSchema });

  const onSubmit = form.handleSubmit(async ({ allocated }) => {
    await api.put(`/leaves/balances/${employeeId}`, { leaveType: balance.leaveType._id, year, allocated });
    toast.success('Leave balance updated');
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Adjust ${balance.leaveType.name}`}
      description={`Used ${balance.used} · Pending ${balance.pending}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="allocation-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="allocation-form" onSubmit={onSubmit} noValidate>
        <Input label={`Allocated days for ${year}`} type="number" min="0" step="0.5" required {...form.register('allocated')} />
      </form>
    </Modal>
  );
}

function EmployeeLeaves({ employeeId, canEdit }) {
  const year = new Date().getFullYear();
  const balances = useFetch(`/leaves/balances/${employeeId}`, { params: { year } });
  const history = useFetch('/leaves', { params: { user: employeeId, limit: 50 } });
  const [editing, setEditing] = useState(null);

  const balanceColumns = [
    {
      key: 'type',
      header: 'Leave type',
      render: (b) => (
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.leaveType.color }} /> {b.leaveType.name}
        </span>
      ),
    },
    { key: 'allocated', header: 'Allocated' },
    { key: 'used', header: 'Used' },
    { key: 'pending', header: 'Pending' },
    { key: 'available', header: 'Available', render: (b) => <strong className="text-slate-900">{b.available}</strong> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (b) =>
        canEdit &&
        b.leaveType.isPaid && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
            Adjust
          </Button>
        ),
    },
  ];

  const historyColumns = [
    { key: 'type', header: 'Type', render: (l) => l.leaveType?.name },
    { key: 'dates', header: 'Dates', render: (l) => <LeaveDates leave={l} /> },
    { key: 'days', header: 'Days' },
    { key: 'status', header: 'Status', render: (l) => <Badge status={l.status} /> },
  ];

  return (
    <div className="space-y-6">
      <Card title={`Leave balance ${year}`} noPadding>
        <DataTable columns={balanceColumns} rows={balances.data} loading={balances.loading} rowKey={(b) => b.leaveType._id} />
      </Card>
      <Card title="Leave history" noPadding>
        <DataTable columns={historyColumns} rows={history.data} loading={history.loading} emptyMessage="No leave requests yet" />
      </Card>
      {editing && (
        <AdjustBalanceModal employeeId={employeeId} balance={editing} year={year} onClose={() => setEditing(null)} onSaved={balances.refetch} />
      )}
    </div>
  );
}

function ResetPasswordModal({ employee, onClose }) {
  const form = useForm({ newPassword: '' }, { schema: resetPasswordSchema });

  const onSubmit = form.handleSubmit(async (data) => {
    await api.patch(`/employees/${employee._id}/reset-password`, data);
    toast.success('Password reset successfully');
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Reset password"
      description={`Set a new password for ${employee.firstName}. Share it securely.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reset-password-form" loading={form.submitting}>
            Reset password
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={onSubmit} noValidate>
        <Input label="New password" type="password" required hint="At least 8 characters with a letter and a number" {...form.register('newPassword')} />
      </form>
    </Modal>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const { isHR } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState('overview');
  const [resetOpen, setResetOpen] = useState(false);
  const { data: employee, loading, error, refetch } = useFetch(`/employees/${id}`);

  useEffect(() => setTab('overview'), [id]);

  const deactivate = async () => {
    const ok = await confirm({
      title: `Deactivate ${employee.firstName}?`,
      message: 'They will no longer be able to log in. Their records (attendance, payslips) are kept.',
      confirmText: 'Deactivate',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Employee deactivated');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !employee) return <PageLoader />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!employee) return null;

  return (
    <div className="space-y-6">
      <Link href={isHR ? '/employees' : '/team/attendance'} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {isHR ? 'All employees' : 'Back'}
      </Link>
      <div>
        <ProfileHeader
          employee={employee}
          actions={
            isHR && (
              <>
                <Link href={`/employees/${id}/edit`}>
                  <Button size="sm" variant="secondary" icon={Pencil}>
                    Edit
                  </Button>
                </Link>
                <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setResetOpen(true)}>
                  Reset password
                </Button>
                {employee.status === 'active' && (
                  <Button size="sm" variant="danger-soft" icon={UserX} onClick={deactivate}>
                    Deactivate
                  </Button>
                )}
              </>
            )
          }
        />
      </div>

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'attendance', label: 'Attendance' },
          { value: 'leave', label: 'Leave' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && <ProfileOverview employee={employee} showSensitive={isHR} />}
      {tab === 'attendance' && <EmployeeAttendance employeeId={id} />}
      {tab === 'leave' && <EmployeeLeaves employeeId={id} canEdit={isHR} />}

      {resetOpen && <ResetPasswordModal employee={employee} onClose={() => setResetOpen(false)} />}
    </div>
  );
}
