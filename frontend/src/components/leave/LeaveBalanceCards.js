import { Skeleton } from '@/components/ui';

// Leave paid through payroll as statutory pay instead of salary
const STATUTORY_TEXT = {
  ssp: 'Paid as Statutory Sick Pay (SSP) through payroll',
  smp: 'Paid as Statutory Maternity Pay (SMP) through payroll',
  spp: 'Paid as Statutory Paternity Pay (SPP) through payroll',
};

// One card per leave type showing available / used / pending
export default function LeaveBalanceCards({ balances, loading }) {
  if (loading && !balances) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {(balances || []).map((b) => {
        const percentLeft = b.allocated ? Math.max(0, Math.min(100, (b.available / b.allocated) * 100)) : 0;
        return (
          <div key={b.leaveType._id} className="card relative overflow-hidden p-5">
            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: b.leaveType.color }} />
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-600">{b.leaveType.name}</p>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: `${b.leaveType.color}1a`, color: b.leaveType.color }}
              >
                {b.leaveType.code}
              </span>
            </div>

            {b.leaveType.isPaid ? (
              <>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight text-slate-900">{b.available}</span>
                  <span className="text-sm text-slate-500">of {b.allocated} days left</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: `${percentLeft}%`, backgroundColor: b.leaveType.color }} />
                </div>
                <p className="mt-2.5 text-xs text-slate-500">
                  {b.used} used{b.pending ? ` · ${b.pending} pending approval` : ''}
                  {b.carriedForward ? ` · incl. ${b.carriedForward} carried over` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight text-slate-900">{b.used}</span>
                  <span className="text-sm text-slate-500">days taken</span>
                </p>
                <p className="mt-6 text-xs text-slate-500">
                  {STATUTORY_TEXT[b.leaveType.statutoryPay] || 'Unpaid leave · salary is deducted'}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
