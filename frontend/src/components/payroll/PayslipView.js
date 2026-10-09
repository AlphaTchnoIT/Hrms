import { formatCurrency, formatDate, getDisplayCurrency, MONTHS } from '@/lib/format';
import { amountInWords } from '@/lib/numberToWords';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

// Printable payslip
export default function PayslipView({ payslip, company }) {
  const emp = payslip.employeeSnapshot || {};
  const rows = Math.max(payslip.earnings.length, payslip.deductions.length);

  return (
    <div className="card mx-auto max-w-3xl p-8 print:border-0 print:shadow-none">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{company?.name}</h2>
          <p className="max-w-sm text-xs text-slate-500">{company?.address}</p>
          {company?.payeReference && <p className="text-xs text-slate-500">Employer PAYE ref: {company.payeReference}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payslip for</p>
          <p className="text-lg font-semibold text-brand-700">
            {MONTHS[payslip.month - 1]} {payslip.year}
          </p>
        </div>
      </div>

      <div className="grid gap-x-10 border-b border-slate-200 py-5 sm:grid-cols-2">
        <div>
          <Row label="Employee name" value={emp.name} />
          <Row label="Employee code" value={emp.employeeCode} />
          <Row label="Designation" value={emp.designation} />
          <Row label="Department" value={emp.department} />
        </div>
        <div>
          <Row label="NI number" value={emp.niNumber} />
          <Row label="Tax code / NI category" value={[emp.taxCode, emp.niCategory].filter(Boolean).join(' / ')} />
          <Row label="Bank" value={[emp.bankName, emp.sortCode].filter(Boolean).join(' · ')} />
          <Row label="Account no." value={emp.accountNumber} />
          <Row label="Date of joining" value={formatDate(emp.dateOfJoining)} />
        </div>
      </div>

      {payslip.payType === 'hourly' ? (
        <div className="grid grid-cols-3 gap-4 border-b border-slate-200 py-4 text-center">
          <div>
            <p className="text-xs text-slate-500">Hours worked (AT)</p>
            <p className="font-semibold">{payslip.hoursWorked ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Hourly rate</p>
            <p className="font-semibold">{formatCurrency(payslip.hourlyRate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Hourly pay</p>
            <p className="font-semibold">{formatCurrency((payslip.hourlyRate || 0) * (payslip.hoursWorked || 0))}</p>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-4 border-b border-slate-200 py-4 text-center">
        <div>
          <p className="text-xs text-slate-500">Working days</p>
          <p className="font-semibold">{payslip.totalDays}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Paid days</p>
          <p className="font-semibold">{payslip.paidDays}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Unpaid days</p>
          <p className="font-semibold text-red-600">{payslip.lopDays}</p>
        </div>
      </div>
      )}

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <th className="px-3 py-2">Earnings</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Deductions</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="px-3 py-2">
                {payslip.earnings[i]?.name}
                {payslip.earnings[i]?.manual && <span className="ml-1 text-[10px] uppercase text-slate-400">manual</span>}
              </td>
              <td className="px-3 py-2 text-right">{payslip.earnings[i] && formatCurrency(payslip.earnings[i].amount)}</td>
              <td className="px-3 py-2">
                {payslip.deductions[i]?.name}
                {payslip.deductions[i]?.manual && <span className="ml-1 text-[10px] uppercase text-slate-400">manual</span>}
              </td>
              <td className="px-3 py-2 text-right">{payslip.deductions[i] && formatCurrency(payslip.deductions[i].amount)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="px-3 py-2">Gross earnings</td>
            <td className="px-3 py-2 text-right">{formatCurrency(payslip.grossEarnings)}</td>
            <td className="px-3 py-2">Total deductions</td>
            <td className="px-3 py-2 text-right">{formatCurrency(payslip.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>
      {payslip.deductionMode === 'manual' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Deductions (tax, NI, pension) are entered manually by the payroll / legal team.</p>
      )}

      <div className="mt-6 rounded-lg bg-brand-50 p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">Net pay</span>
          <span className="text-2xl font-bold text-brand-700">{formatCurrency(payslip.netPay)}</span>
        </div>
        {getDisplayCurrency() === 'INR' && <p className="mt-1 text-xs text-slate-600">{amountInWords(payslip.netPay, getDisplayCurrency())}</p>}
        {payslip.taxablePay !== undefined && <p className="mt-1 text-xs text-slate-600">Taxable pay this month: {formatCurrency(payslip.taxablePay)}</p>}
      </div>

      {payslip.employerContributions?.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Paid by your employer (not deducted)</p>
          {payslip.employerContributions.map((c) => (
            <Row key={c.name} label={c.name} value={formatCurrency(c.amount)} />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-400">
        This is a computer generated payslip and does not require a signature.
      </p>
    </div>
  );
}
