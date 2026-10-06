'use client';

import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { employeeSchema } from '@/lib/validation';
import { BLOOD_GROUPS, EMPLOYEE_STATUS, EMPLOYMENT_TYPES, GENDERS, MARITAL_STATUS, NI_CATEGORIES, ROLES, STUDENT_LOAN_PLANS } from '@/lib/constants';
import { formatCurrency, getFullName, toInputDate, getCurrencySymbol } from '@/lib/format';
import { Button, Card, Checkbox, FormSection, Input, Select } from '@/components/ui';

// Convert an employee from the API into flat form values
export function toFormValues(employee = {}) {
  const salary = employee.salary || {};
  return {
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    email: employee.email || '',
    phone: employee.phone || '',
    password: '',
    role: employee.role || ROLES.EMPLOYEE,
    status: employee.status || 'active',
    department: employee.department?._id || '',
    designation: employee.designation?._id || '',
    reportingManager: employee.reportingManager?._id || '',
    employmentType: employee.employmentType || 'full-time',
    dateOfJoining: toInputDate(employee.dateOfJoining || new Date()),
    workLocation: employee.workLocation || '',
    gender: employee.gender || '',
    dateOfBirth: employee.dateOfBirth ? toInputDate(employee.dateOfBirth) : '',
    maritalStatus: employee.maritalStatus || '',
    bloodGroup: employee.bloodGroup || '',
    niNumber: employee.niNumber || '',
    bankDetails: {
      accountHolderName: employee.bankDetails?.accountHolderName || '',
      bankName: employee.bankDetails?.bankName || '',
      accountNumber: employee.bankDetails?.accountNumber || '',
      sortCode: employee.bankDetails?.sortCode || '',
    },
    salary: {
      annualSalary: salary.annualSalary ?? '',
      monthlyAllowance: salary.monthlyAllowance ?? '',
      taxCode: salary.taxCode || '1257L',
      niCategory: salary.niCategory || 'A',
      pensionEnrolled: salary.pensionEnrolled ?? true,
      studentLoanPlan: salary.studentLoanPlan || 'none',
      postgraduateLoan: salary.postgraduateLoan ?? false,
    },
  };
}

// Gross pay per month = annual salary / 12 + monthly allowance
const monthlyGross = (salary) => (Number(salary.annualSalary) || 0) / 12 + (Number(salary.monthlyAllowance) || 0);

export default function EmployeeForm({ initialValues, isEdit = false, onSubmit, onCancel, employeeId }) {
  const { isAdmin } = useAuth();
  const form = useForm(initialValues, { schema: employeeSchema });
  const { register, values } = form;

  const departments = useFetch('/departments');
  const designations = useFetch('/designations');
  const people = useFetch('/employees/directory', { params: { limit: 200 } });

  const roleOptions = Object.values(ROLES)
    .filter((role) => isAdmin || role !== ROLES.ADMIN)
    .map((role) => ({ value: role, label: { hr: 'HR', qa: 'QA Auditor', it: 'IT Support' }[role] || role[0].toUpperCase() + role.slice(1) }));
  const managerOptions = (people.data || [])
    .filter((p) => p._id !== employeeId)
    .map((p) => ({ value: p._id, label: `${getFullName(p)} (${p.employeeCode})` }));

  const gross = monthlyGross(values.salary);

  const handleSubmit = form.handleSubmit(async (data) => {
    const payload = { ...data, dateOfBirth: data.dateOfBirth || null };
    if (isEdit || !payload.password) delete payload.password;
    await onSubmit(payload);
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="pb-24">
      <Card>
        <FormSection title="Basic information" description="Name and login details. The work email is used to sign in.">
          <Input label="First name" required {...register('firstName')} />
          <Input label="Last name" {...register('lastName')} />
          <Input label="Work email" type="email" required {...register('email')} />
          <Input label="Mobile number" placeholder="07700 900123" {...register('phone')} />
          <Select label="Role" required placeholder={false} options={roleOptions} {...register('role')} hint="Controls what this person can access" />
          {isEdit ? (
            <Select label="Status" placeholder={false} options={EMPLOYEE_STATUS} {...register('status')} />
          ) : (
            <Input label="Initial password" type="password" {...register('password')} hint="Leave empty to use Welcome@123" />
          )}
        </FormSection>

        <FormSection title="Job details" description="Where this person sits in the organization.">
          <Select label="Department" options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))} {...register('department')} />
          <Select label="Designation" options={(designations.data || []).map((d) => ({ value: d._id, label: d.title }))} {...register('designation')} />
          <Select label="Reporting manager" placeholder="No manager" options={managerOptions} {...register('reportingManager')} />
          <Select label="Employment type" required placeholder={false} options={EMPLOYMENT_TYPES} {...register('employmentType')} />
          <Input label="Date of joining" type="date" required {...register('dateOfJoining')} />
          <Input label="Work location" placeholder="e.g. London" {...register('workLocation')} />
        </FormSection>

        <FormSection title="Personal details" description="Used for HR records and celebrations.">
          <Select label="Gender" options={GENDERS} {...register('gender')} />
          <Input label="Date of birth" type="date" max={toInputDate()} {...register('dateOfBirth')} />
          <Select label="Marital status" options={MARITAL_STATUS} {...register('maritalStatus')} />
          <Select label="Blood group" options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} {...register('bloodGroup')} />
        </FormSection>

        <FormSection title="Bank & National Insurance" description="Salary is paid into this account. Shown on payslips.">
          <Input label="Account holder name" {...register('bankDetails.accountHolderName')} />
          <Input label="Bank name" placeholder="e.g. Barclays" {...register('bankDetails.bankName')} />
          <Input label="Sort code" placeholder="12-34-56" {...register('bankDetails.sortCode')} />
          <Input label="Account number" inputMode="numeric" maxLength={8} placeholder="8 digits" {...register('bankDetails.accountNumber')} />
          <Input label="National Insurance number" placeholder="QQ 12 34 56 C" {...register('niNumber')} />
        </FormSection>

        <FormSection title="Pay & tax (PAYE)" description="Payroll works out Income Tax, National Insurance, pension and student loan each month.">
          <Input label="Annual salary" type="number" min="0" prefix={getCurrencySymbol()} hint="Gross per year, before tax" {...register('salary.annualSalary')} />
          <Input label="Monthly allowance" type="number" min="0" prefix={getCurrencySymbol()} hint="e.g. London weighting, car allowance" {...register('salary.monthlyAllowance')} />
          <Input label="Tax code" placeholder="1257L" hint="From HMRC / the P45. S… = Scottish, C… = Welsh" {...register('salary.taxCode')} />
          <Select label="NI category" placeholder={false} options={NI_CATEGORIES} {...register('salary.niCategory')} />
          <Select label="Student loan" placeholder={false} options={STUDENT_LOAN_PLANS} {...register('salary.studentLoanPlan')} />
          <div className="space-y-3">
            <Checkbox label="Workplace pension" description="Auto-enrolled: employee and employer contributions" {...register('salary.pensionEnrolled', { type: 'checkbox' })} />
            <Checkbox label="Postgraduate loan" description="Deduct postgraduate loan repayments" {...register('salary.postgraduateLoan', { type: 'checkbox' })} />
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Gross per month</p>
            <p className="text-lg font-semibold text-slate-900">{formatCurrency(gross)}</p>
            <p className="text-xs text-slate-500">{formatCurrency(gross * 12)} per year</p>
          </div>
        </FormSection>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="hidden text-sm text-slate-500 sm:block">
            Fields marked <span className="text-red-500">*</span> are required
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={form.submitting}>
              {isEdit ? 'Save changes' : 'Create employee'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
