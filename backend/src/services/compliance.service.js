import { ComplianceItem } from '../models/index.js';

/*
 * Built-in UK checklist. Added once per database (and new items when the app adds them);
 * admins can edit, mark not applicable, or add their own.
 */
const UK_CHECKLIST = [
  // Contracts & policies
  ['contracts', 'Contracts & policies', 'Employment contract template reviewed', 'Written statement of employment particulars given on or before day one (Employment Rights Act 1996).'],
  ['handbook', 'Contracts & policies', 'Staff handbook and policies reviewed', 'Disciplinary and grievance (ACAS Code of Practice), sickness absence, holiday, flexible working, whistleblowing, equal opportunities, anti-harassment incl. the duty to prevent sexual harassment.'],
  ['holiday-policy', 'Contracts & policies', 'Holiday policy and leave year agreed', 'Entitlement (at least 5.6 weeks incl. bank holidays), leave year, carry-over and part-time pro-rata match the app.', '/settings'],
  ['sickness-policy', 'Contracts & policies', 'Sick pay and family pay policy agreed', 'Company sick pay days, when SSP applies, enhanced maternity / paternity pay, fit note rules.', '/settings'],
  ['notice', 'Contracts & policies', 'Notice periods and probation terms agreed', 'Contractual notice never below the statutory minimum; probation length and review process.'],
  // Right to work & safety
  ['rtw', 'Right to work & safety', 'Right to work check process agreed', 'Home Office checks before day one, copies kept, follow-up checks for time-limited permission (civil penalty up to £60,000 per illegal worker).', '/employees'],
  ['elci', 'Right to work & safety', "Employers' liability insurance in place", 'Legally required from the first employee; certificate available to staff.'],
  ['health-safety', 'Right to work & safety', 'Health and safety policy and risk assessments', 'Written policy required with 5 or more employees; display the HSE poster.'],
  // Payroll, HMRC & pensions
  ['paye', 'Payroll, HMRC & pensions', 'PAYE scheme registered with HMRC', 'Employer PAYE and Accounts Office references entered in Settings (shown on payslips).', '/settings'],
  ['rti', 'Payroll, HMRC & pensions', 'RTI filing set up and payroll reconciled', 'Full Payment Submissions sent to HMRC on or before payday from HMRC-recognised software; payslips from this app checked against it by the accountant.'],
  ['rates', 'Payroll, HMRC & pensions', 'UK payroll rates checked for this tax year', 'Tax bands, NI, student loans, SSP / SMP, minimum wage and pension thresholds in Settings -> UK payroll rates (every April).', '/settings'],
  ['pension', 'Payroll, HMRC & pensions', 'Workplace pension scheme and declaration of compliance', 'Scheme set up, staff assessed and enrolled, declaration of compliance sent to The Pensions Regulator, re-enrolment every 3 years.', '/settings'],
  // Data protection
  ['ico', 'Data protection (UK GDPR)', 'ICO data protection fee paid', 'Registration number entered in Settings.', '/settings'],
  ['dpa', 'Data protection (UK GDPR)', 'Data processing agreement with the HRMS provider', 'Article 28 contract between the company (controller) and the provider (processor).'],
  ['transfers', 'Data protection (UK GDPR)', 'International data transfer assessment', 'Needed if the HRMS is hosted or supported from outside the UK (e.g. India): transfer risk assessment and the UK IDTA or Addendum.'],
  ['privacy-notice', 'Data protection (UK GDPR)', 'Staff privacy notice published', 'Link added in Settings so every employee can open it from their account menu.', '/settings'],
  ['dpia', 'Data protection (UK GDPR)', 'DPIA for Live Work Status (or switched off)', 'Monitoring staff activity needs a data protection impact assessment and clear notice to staff.', '/settings'],
  ['retention', 'Data protection (UK GDPR)', 'Data retention schedule agreed', 'How long leavers’ records are kept (Settings -> retention years) and how requests for data are handled.', '/settings'],
  // Reporting
  ['gpg', 'Reporting', 'Gender pay gap reporting (250+ employees)', 'Snapshot on 5 April, published by 4 April the next year (Reports -> Gender pay gap).', '/reports'],
  ['modern-slavery', 'Reporting', 'Modern slavery statement (turnover £36m+)', 'Annual statement published on the website.'],
];

export async function ensureDefaultChecklist() {
  const existing = new Set(await ComplianceItem.find({ key: { $ne: null } }).distinct('key'));
  const missing = UK_CHECKLIST.filter(([key]) => !existing.has(key));
  if (!missing.length) return;
  await ComplianceItem.insertMany(
    missing.map(([key, category, title, description, settingsLink], i) => ({ key, category, title, description, settingsLink, order: UK_CHECKLIST.findIndex(([k]) => k === key) * 10 || i }))
  );
}
