import { Card } from '@/components/ui';
import DetailItem from '@/components/shared/DetailItem';
import { formatCurrency, formatDate, getFullName, titleCase } from '@/lib/format';

// Read-only view of an employee's details (used on My Profile and Employee detail)
export default function ProfileOverview({ employee, showSensitive = false }) {
  const address = employee.address || {};
  const salary = employee.salary;
  const monthlyGross = salary
    ? (salary.basic || 0) + (salary.hra || 0) + (salary.conveyance || 0) + (salary.specialAllowance || 0) + (salary.otherAllowance || 0)
    : 0;

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
              value={[address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ')}
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
          <Card title="Bank & tax">
            <dl className="grid grid-cols-2 gap-4">
              <DetailItem label="Bank" value={employee.bankDetails?.bankName} />
              <DetailItem label="Account number" value={employee.bankDetails?.accountNumber} />
              <DetailItem label="IFSC" value={employee.bankDetails?.ifsc} />
              <DetailItem label="PAN" value={employee.panNumber} />
            </dl>
          </Card>

          {salary && (
            <Card title="Salary structure (monthly)">
              <dl className="grid grid-cols-2 gap-4">
                <DetailItem label="Basic" value={formatCurrency(salary.basic)} />
                <DetailItem label="HRA" value={formatCurrency(salary.hra)} />
                <DetailItem label="Conveyance" value={formatCurrency(salary.conveyance)} />
                <DetailItem label="Special allowance" value={formatCurrency(salary.specialAllowance)} />
                <DetailItem label="Other allowance" value={formatCurrency(salary.otherAllowance)} />
                <DetailItem label="Monthly TDS" value={formatCurrency(salary.monthlyTds)} />
                <DetailItem label="PF applicable" value={salary.pfApplicable ? 'Yes' : 'No'} />
                <DetailItem label="Gross / month" value={<strong>{formatCurrency(monthlyGross)}</strong>} />
              </dl>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
