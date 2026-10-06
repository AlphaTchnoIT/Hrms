/*
 * UK employment checks shown as hints in forms. Same rules as backend/src/services/ukCompliance.service.js
 * (the server is the source of truth for payroll and reports); rates come from Settings -> UK payroll rates.
 */

export function ageOn(dateOfBirth, on = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  if (on.getUTCMonth() < dob.getUTCMonth() || (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

const annualPay = (salary = {}) => (Number(salary.annualSalary) || 0) + (Number(salary.monthlyAllowance) || 0) * 12;

export function minimumWageCheck({ dateOfBirth, dateOfJoining, employmentType, contractedHoursPerWeek, salary }, rates) {
  const hours = Number(contractedHoursPerWeek) || 0;
  const annual = annualPay(salary);
  if (!hours || !annual || !rates?.minimumWage) return null;
  const hourly = Math.round((annual / 52 / hours) * 100) / 100;
  const age = ageOn(dateOfBirth);
  const firstYear = dateOfJoining && Date.now() - new Date(dateOfJoining) < 365 * 86400000;
  let band = 'age21';
  if (employmentType === 'apprentice' && (age === null || age < 19 || firstYear)) band = 'apprentice';
  else if (age !== null && age < 18) band = 'under18';
  else if (age !== null && age < 21) band = 'age18';
  return { hourly, required: rates.minimumWage[band], ok: hourly >= rates.minimumWage[band] };
}

export function autoEnrolmentStatus({ dateOfBirth, salary }, rates) {
  if (!rates) return null;
  const annual = annualPay(salary);
  const age = ageOn(dateOfBirth);
  const spa = dateOfBirth && new Date(dateOfBirth) >= new Date('1961-03-06') ? 67 : 66;
  if (age === null) return annual > rates.autoEnrolmentTrigger ? 'eligible' : 'entitled';
  if (age >= 22 && age < spa && annual > rates.autoEnrolmentTrigger) return 'eligible';
  if (age >= 16 && age <= 74 && annual > rates.pensionLowerLimit) return 'non-eligible';
  return 'entitled';
}

export const PENSION_STATUS_TEXT = {
  eligible: 'Eligible jobholder: must be auto-enrolled (they may opt out later)',
  'non-eligible': 'Non-eligible: can opt in, employer must then contribute',
  entitled: 'Entitled worker: can ask to join (no employer contribution required)',
};

export function statutoryNoticeWeeks(dateOfJoining) {
  if (!dateOfJoining) return 0;
  const days = (Date.now() - new Date(dateOfJoining)) / 86400000;
  if (days < 31) return 0;
  return Math.min(12, Math.max(1, Math.floor(days / 365.25)));
}
