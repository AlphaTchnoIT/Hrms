'use client';

import Link from 'next/link';
import {
  BarChart3,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  PieChart,
  Receipt,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { Card, ErrorMessage, PageLoader, StatCard } from '@/components/ui';
import CheckInCard from '@/components/attendance/CheckInCard';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';
import LeaveBalanceCards from '@/components/leave/LeaveBalanceCards';
import { AttendanceTrendChart, DepartmentChart } from '@/components/dashboard/Charts';
import { AnnouncementsWidget, CelebrationsWidget, UpcomingHolidays, WhoIsOutWidget } from '@/components/dashboard/Widgets';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS = [
  { label: 'Apply leave', href: '/leave', icon: CalendarPlus },
  { label: 'Regularize', href: '/attendance', icon: CalendarClock },
  { label: 'New expense', href: '/expenses', icon: Receipt },
];

function PendingApprovals({ stats }) {
  const items = [
    { label: 'Leave requests', value: stats.pendingLeaves, href: '/team/leave-approvals', icon: ClipboardCheck, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Regularizations', value: stats.pendingRegularizations, href: '/team/regularizations', icon: CalendarClock, tone: 'text-sky-600 bg-sky-50' },
    { label: 'Expense claims', value: stats.pendingExpenses, href: '/team/expense-approvals', icon: Receipt, tone: 'text-amber-600 bg-amber-50' },
  ];
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <Card title="Pending approvals" subtitle={total ? `${total} waiting for you` : 'All caught up'} icon={ClipboardCheck} className="h-full" noPadding>
      <ul className="divide-y divide-slate-100">
        {items.map(({ label, value, href, icon: Icon, tone }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
              <span className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {value}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isHR, isApprover } = useAuth();
  const { data, loading, error, refetch } = useFetch('/dashboard');
  const now = new Date();
  const myMonth = useFetch(isApprover ? null : '/attendance/my', { params: { month: now.getMonth() + 1, year: now.getFullYear() } });

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  const stats = data.stats;

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {greeting()}, {user.firstName} 👋
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Team / company KPIs */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label={isHR ? 'Active employees' : 'Team members'} value={stats.totalEmployees} icon={Users} tone="brand" href={isHR ? '/employees' : undefined} hint={isHR ? `${stats.newJoiners} joined this month` : undefined} />
          <StatCard label="Present today" value={stats.presentToday} icon={UserCheck} tone="green" hint={`${stats.lateToday} came in late`} href="/team/attendance" />
          <StatCard label="On leave" value={stats.onLeaveToday} icon={CalendarX2} tone="purple" href="/team/attendance" />
          <StatCard label="Not checked in" value={stats.absentToday} icon={Clock} tone="red" href="/team/attendance" />
        </div>
      )}

      {/* Check-in + main panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        <CheckInCard onChange={refetch} />
        <div className="lg:col-span-2">
          {data.attendanceTrend ? (
            <Card title="Attendance — last 7 days" subtitle="Check-ins per day" icon={BarChart3} className="h-full">
              <AttendanceTrendChart data={data.attendanceTrend} />
            </Card>
          ) : (
            <div className="flex h-full flex-col gap-6">
              <AttendanceSummary summary={myMonth.data?.summary} />
              <Card title="My pending requests" className="flex-1">
                <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                  {[
                    ['Leaves', data.myPending.leaves, '/leave'],
                    ['Regularizations', data.myPending.regularizations, '/attendance'],
                    ['Expenses', data.myPending.expenses, '/expenses'],
                  ].map(([label, value, href]) => (
                    <Link key={label} href={href} className="rounded-lg py-1 transition hover:bg-slate-50">
                      <p className="text-2xl font-semibold text-slate-900">{value}</p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Approver row */}
      {stats && (
        <div className="grid gap-6 lg:grid-cols-3">
          <PendingApprovals stats={stats} />
          <WhoIsOutWidget leaves={data.whoIsOut} />
          <CelebrationsWidget items={data.celebrations} />
        </div>
      )}

      {/* Leave balance */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">My leave balance</h2>
          <Link href="/leave" className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Apply leave →
          </Link>
        </div>
        <LeaveBalanceCards balances={data.leaveBalances} />
      </div>

      {/* Company row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AnnouncementsWidget announcements={data.announcements} />
        <UpcomingHolidays holidays={data.upcomingHolidays} />
        {isHR && data.departmentHeadcount ? (
          <Card title="Headcount by department" icon={PieChart} className="h-full">
            <DepartmentChart data={data.departmentHeadcount} />
          </Card>
        ) : stats ? (
          <StatCard label="New joiners this month" value={stats.newJoiners} icon={UserPlus} tone="blue" />
        ) : (
          <div className="grid gap-6">
            <WhoIsOutWidget leaves={data.whoIsOut} />
            <CelebrationsWidget items={data.celebrations} />
          </div>
        )}
      </div>
    </div>
  );
}
