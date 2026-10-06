import { Card } from '@/components/ui';
import DetailItem from '@/components/shared/DetailItem';
import { formatCurrency, formatDate, getFullName, titleCase } from '@/lib/format';
import { HOLIDAY_REGIONS, NI_CATEGORIES, RIGHT_TO_WORK_STATUS, STUDENT_LOAN_PLANS } from '@/lib/constants';

// Read-only view of an employee's details (used on My Profile and Employee detail)
export default function ProfileOverview({ employee, showSensitive = false }) {
  const address = employee.address || {};
  const salary = employee.salary;
  const monthlyGross = salary ? (salary.annualSalary || 0) / 12 + (salary.monthlyAllowance || 0) : 0;
  const labelOf = (list, value) => list.find((o) => o.value === value)?.label || value;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Job details">
        <dl className="grid grid-cols-2 gap-4">
          <DetailItem label="Employee code" value={employee.employeeCode} />
          <DetailItem label="Department" value={employee.department?.name} />
          <DetailItem label="Designation" value={employee.designation?.title} />
          <DetailItem label="Reporting manager" value={employee.reportingManager ? getFullName(employee.reportingManager) : null} />
          <DetailItem label="Employment type" value={titleCase(employee.employmentType)} />
          <DetailItem label="Date of joining" value={formatDate(employee.dateOfJoining)} />
          <DetailItem label="Work location" value={employee.workLocation} />
          <DetailItem label="Bank holidays" value={labelOf(HOLIDAY_REGIONS, employee.holidayRegion || 'england-wales')} />
          <DetailItem label="Working days / week" value={employee.workingDaysPerWeek ?? 5} />
          <DetailItem label="Probation ends" value={employee.probationEndDate ? formatDate(employee.probationEndDate) : null} />
          <DetailItem label="Contracted hours / week" value={employee.contractedHoursPerWeek ?? 37.5} />
          <DetailItem label="Notice period" value={employee.noticePeriodWeeks !== undefined && employee.noticePeriodWeeks !== null ? `${employee.noticePeriodWeeks} weeks` : null} />
          <DetailItem label="48-hour opt-out" value={employee.wtrOptOut ? 'Signed' : 'No'} />
          <DetailItem label="Role" value={titleCase(employee.role)} />
        </dl>
      </Card>

      <Card title="Personal details">
        <dl className="grid grid-cols-2 gap-4">
          <DetailItem label="Email" value={employee.email} />
          <DetailItem label="Phone" value={employee.phone} />
          <DetailItem label="Date of birth" value={employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null} />
          <DetailItem label="Gender" value={titleCase(employee.gender || '')} />
          <DetailItem label="Marital status" value={titleCase(employee.maritalStatus || '')} />
          <DetailItem label="Blood group" value={employee.bloodGroup} />
          <div className="col-span-2">
            <DetailItem
              label="Address"
              value={[address.line1, address.line2, address.city, address.county, address.postcode, address.country].filter(Boolean).join(', ')}
            />
          </div>
          <DetailItem
            label="Emergency contact"
            value={
              employee.emergencyContact?.name
                ? `${employee.emergencyContact.name} (${employee.emergencyContact.relation || '—'})`
                : null
            }
          />
          <DetailItem label="Emergency phone" value={employee.emergencyContact?.phone} />
        </dl>
      </Card>

      {showSensitive && (
        <>
          <Card title="Right to work">
            <dl className="grid grid-cols-2 gap-4">
              <DetailItem label="Status" value={labelOf(RIGHT_TO_WORK_STATUS, employee.rightToWork?.status || 'not-checked')} />
              <DetailItem label="Document / check" value={employee.rightToWork?.documentType} />
              <DetailItem label="Share code" value={employee.rightToWork?.shareCode} />
              <DetailItem label="Checked on" value={employee.rightToWork?.checkedOn ? formatDate(employee.rightToWork.checkedOn) : null} />
              {employee.rightToWork?.status === 'time-limited' && (
                <DetailItem label="Permission expires" value={employee.rightToWork.expiryDate ? formatDate(employee.rightToWork.expiryDate) : null} />
              )}
            </dl>
          </Card>

          <Card title="Bank & National Insurance">
            <dl className="grid grid-cols-2 gap-4">
              <DetailItem label="Bank" value={employee.bankDetails?.bankName} />
              <DetailItem label="Sort code" value={employee.bankDetails?.sortCode} />
              <DetailItem label="Account number" value={employee.bankDetails?.accountNumber} />
              <DetailItem label="NI number" value={employee.niNumber} />
            </dl>
          </Card>

          {salary && (
            <Card title="Pay & tax">
              <dl className="grid grid-cols-2 gap-4">
                <DetailItem label="Annual salary" value={formatCurrency(salary.annualSalary)} />
                <DetailItem label="Monthly allowance" value={formatCurrency(salary.monthlyAllowance)} />
                <DetailItem label="Tax code" value={salary.taxCode} />
                <DetailItem label="NI category" value={labelOf(NI_CATEGORIES, salary.niCategory)} />
                <DetailItem
                  label="Workplace pension"
                  value={salary.pensionEnrolled === false || salary.pensionOptedOutOn ? `Not enrolled${salary.pensionOptedOutOn ? ` (opted out ${formatDate(salary.pensionOptedOutOn)})` : ''}` : 'Enrolled'}
                />
                <DetailItem label="Student loan" value={`${labelOf(STUDENT_LOAN_PLANS, salary.studentLoanPlan || 'none')}${salary.postgraduateLoan ? ' + Postgraduate' : ''}`} />
                <DetailItem label="Gross / month" value={<strong>{formatCurrency(monthlyGross)}</strong>} />
              </dl>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
