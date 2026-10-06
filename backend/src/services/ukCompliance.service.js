/*
 * UK employment rules used across the app (pure functions, unit-tested in tests/ukCompliance.test.js).
 * Figures come from Settings -> UK payroll rates (defaults: GOV.UK 2026/27).
 */

const DAY = 86400000;

// Age in whole years on a date
export function ageOn(dateOfBirth, on = new Date()) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const at = new Date(on);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = at.getUTCMonth() < dob.getUTCMonth() || (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/*
 * State Pension age (simplified): 66, rising to 67 for people born on or after 6 March 1961
 * (the rise from 66 to 67 happens between 2026 and 2028). Good enough for auto-enrolment checks.
 */
export function statePensionAge(dateOfBirth) {
  if (!dateOfBirth) return 66;
  return new Date(dateOfBirth) >= new Date('1961-03-06') ? 67 : 66;
}

/*
 * Workplace pension auto-enrolment category (Pensions Regulator):
 * - eligible: 22 to State Pension age and earning over the trigger (£10,000) -> must be enrolled
 * - non-eligible: can opt in (employer must contribute) - age 16-74 earning over the lower limit, or 16-21 / SPA-74 over the trigger
 * - entitled: can ask to join (no employer contribution required)
 */
export function autoEnrolmentStatus(user, rates, on = new Date()) {
  const annual = (user.salary?.annualSalary || 0) + (user.salary?.monthlyAllowance || 0) * 12;
  const age = ageOn(user.dateOfBirth, on);
  if (age === null) return annual > rates.autoEnrolmentTrigger ? 'eligible' : 'entitled';
  const spa = statePensionAge(user.dateOfBirth);
  if (age >= 22 && age < spa && annual > rates.autoEnrolmentTrigger) return 'eligible';
  if (age >= 16 && age <= 74 && annual > rates.pensionLowerLimit) return 'non-eligible';
  return 'entitled';
}

/*
 * National Minimum / Living Wage check on contracted hours.
 * Apprentice rate: apprentices under 19, or in the first year of the apprenticeship.
 */
export function minimumWageCheck(user, rates, on = new Date()) {
  const hours = user.contractedHoursPerWeek || 0;
  const annual = (user.salary?.annualSalary || 0) + (user.salary?.monthlyAllowance || 0) * 12;
  if (!hours || !annual) return null;
  const hourly = Math.round((annual / 52 / hours) * 100) / 100;
  const age = ageOn(user.dateOfBirth, on);
  const firstYear = user.dateOfJoining && new Date(on) - new Date(user.dateOfJoining) < 365 * DAY;
  const w = rates.minimumWage;
  let band = 'age21';
  if (user.employmentType === 'apprentice' && (age === null || age < 19 || firstYear)) band = 'apprentice';
  else if (age !== null && age < 18) band = 'under18';
  else if (age !== null && age < 21) band = 'age18';
  const required = w[band];
  return { hourly, required, band, ok: hourly >= required };
}

// Statutory minimum notice from the employer: 1 week after a month, then 1 week per full year, up to 12
export function statutoryNoticeWeeks(dateOfJoining, on = new Date()) {
  if (!dateOfJoining) return 0;
  const days = (new Date(on) - new Date(dateOfJoining)) / DAY;
  if (days < 31) return 0;
  return Math.min(12, Math.max(1, Math.floor(days / 365.25)));
}

// Average weekly earnings used for statutory pay (contractual pay x 12 / 52)
export function averageWeeklyEarnings(salary = {}) {
  return (((salary.annualSalary || 0) / 12 + (salary.monthlyAllowance || 0)) * 12) / 52;
}

const round2 = (n) => Math.round(n * 100) / 100;
const dateDiffDays = (a, b) => Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / DAY);

/*
 * Statutory pay for one month from approved leave whose leave type pays SSP / SMP / SPP.
 * - SSP (from April 2026: from day one): lower of the weekly rate or 80% of AWE, per qualifying (working) day
 * - SMP: 90% of AWE for 6 weeks, then the lower of the flat rate or 90% of AWE up to week 39; paid per calendar day
 * - SPP: lower of the flat rate or 90% of AWE, up to 2 weeks; paid per calendar day
 * `sickDays` = working days on SSP leave this month (from the attendance calendar).
 */
export function calculateStatutoryPay({ salary, workingDaysPerWeek = 5, leaves = [], sickDays = 0, monthStart, monthEnd, rates }) {
  const awe = averageWeeklyEarnings(salary);
  const items = [];

  if (sickDays > 0) {
    const weekly = Math.min(rates.sspWeeklyRate, awe * 0.8);
    items.push({ name: 'Statutory Sick Pay (SSP)', amount: round2((weekly / Math.max(1, workingDaysPerWeek)) * sickDays) });
  }

  let smp = 0;
  let spp = 0;
  leaves.forEach((leave) => {
    const kind = leave.leaveType?.statutoryPay;
    if (!['smp', 'spp'].includes(kind)) return;
    const from = leave.fromDate > monthStart ? leave.fromDate : monthStart;
    const to = leave.toDate < monthEnd ? leave.toDate : monthEnd;
    for (let offset = dateDiffDays(from, leave.fromDate); offset <= dateDiffDays(to, leave.fromDate); offset += 1) {
      const week = Math.floor(offset / 7) + 1;
      if (kind === 'smp' && week <= 39) smp += (week <= 6 ? awe * 0.9 : Math.min(rates.statutoryFlatRate, awe * 0.9)) / 7;
      if (kind === 'spp' && week <= 2) spp += Math.min(rates.statutoryFlatRate, awe * 0.9) / 7;
    }
  });
  if (smp > 0) items.push({ name: 'Statutory Maternity Pay (SMP)', amount: round2(smp) });
  if (spp > 0) items.push({ name: 'Statutory Paternity Pay (SPP)', amount: round2(spp) });
  return items;
}

// Bradford Factor = spells² x days (sickness absence over the last 52 weeks)
export function bradfordFactor(spells, days) {
  return spells * spells * days;
}

/*
 * Gender pay gap (Equality Act 2010 reporting, 250+ employees): mean and median hourly pay gap
 * between men and women as % of men's pay, and the share of women in each pay quartile.
 */
export function genderPayGap(people) {
  const withPay = people.filter((p) => p.hourly > 0 && ['male', 'female'].includes(p.gender));
  const men = withPay.filter((p) => p.gender === 'male').map((p) => p.hourly);
  const women = withPay.filter((p) => p.gender === 'female').map((p) => p.hourly);
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const median = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const gap = (m, w) => Math.round(((m - w) / m) * 1000) / 10;
  if (!men.length || !women.length) return null;

  const sorted = [...withPay].sort((a, b) => a.hourly - b.hourly);
  const quartiles = [0, 1, 2, 3].map((q) => {
    const slice = sorted.slice(Math.floor((q * sorted.length) / 4), Math.floor(((q + 1) * sorted.length) / 4));
    const female = slice.filter((p) => p.gender === 'female').length;
    return { quartile: ['Lower', 'Lower middle', 'Upper middle', 'Upper'][q], people: slice.length, womenPercent: slice.length ? Math.round((female / slice.length) * 100) : 0 };
  });
  return {
    men: men.length,
    women: women.length,
    meanGap: gap(mean(men), mean(women)),
    medianGap: gap(median(men), median(women)),
    meanHourly: { men: round2(mean(men)), women: round2(mean(women)) },
    medianHourly: { men: round2(median(men)), women: round2(median(women)) },
    quartiles,
  };
}
