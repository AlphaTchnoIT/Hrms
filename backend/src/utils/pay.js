/*
 * Expected yearly pay. Hourly workers: hourly rate x contracted hours x 52 (their actual pay depends on hours worked,
 * so this is only an estimate; payroll uses actual earnings where it can).
 */
export function annualPay(salary = {}, contractedHoursPerWeek = 0) {
  const base = salary.payType === 'hourly' ? (salary.hourlyRate || 0) * (contractedHoursPerWeek || 0) * 52 : salary.annualSalary || 0;
  return base + (salary.monthlyAllowance || 0) * 12;
}
