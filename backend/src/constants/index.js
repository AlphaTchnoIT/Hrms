export const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  QA: 'qa', // quality auditor
  IT: 'it', // IT support agent
};

// Role groups used by route guards
export const HR_ROLES = [ROLES.ADMIN, ROLES.HR];
export const APPROVER_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER];
export const QA_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.QA];
export const AUDITOR_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.QA]; // can record QA feedback / KPIs
export const IT_ROLES = [ROLES.ADMIN, ROLES.IT];

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'fixed-term', 'zero-hours', 'contract', 'apprentice', 'intern'];
export const EMPLOYEE_STATUS = ['active', 'inactive', 'terminated'];

export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const ATTENDANCE_STATUS = ['present', 'half-day', 'absent'];

export const EXPENSE_CATEGORIES = ['travel', 'mileage', 'food', 'accommodation', 'office-supplies', 'internet', 'other'];
export const EXPENSE_STATUS = ['pending', 'approved', 'rejected', 'reimbursed'];

export const GOAL_STATUS = ['not-started', 'in-progress', 'completed'];

export const ASSET_CATEGORIES = ['laptop', 'desktop', 'monitor', 'mobile', 'accessory', 'furniture', 'other'];
export const ASSET_STATUS = ['available', 'assigned', 'maintenance', 'retired'];

// UK: bank holidays (England & Wales), regional ones (Scotland / Northern Ireland), optional and company days
export const HOLIDAY_TYPES = ['bank-holiday', 'regional', 'optional', 'company'];

/*
 * UK payroll (PAYE). Defaults = GOV.UK "Rates and thresholds for employers 2026 to 2027" and the
 * Pensions Regulator auto-enrolment thresholds for 2026/27. Editable in Settings -> UK payroll; check every April.
 * NI categories: A standard, M under 21, H apprentice under 25, C over State Pension age, X not liable.
 */
export const NI_CATEGORIES = ['A', 'M', 'H', 'C', 'X'];

// UK nations have different bank holidays
export const HOLIDAY_REGIONS = ['england-wales', 'scotland', 'northern-ireland'];

// Right to work in the UK (Home Office checks): time-limited permission needs a follow-up check before it expires
export const RIGHT_TO_WORK_STATUS = ['not-checked', 'british-irish', 'settled', 'time-limited'];

// Modules a company can switch off in Settings
export const FEATURES = ['payroll', 'workStatus', 'chat'];

// Chat: messages are deleted automatically after this many days (UK GDPR storage limitation)
export const CHAT_RETENTION_DAYS = 365;
export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_GROUP_MAX_MEMBERS = 100;
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Chat files are stored in MongoDB (GridFS) for now, so they are kept small and short-lived
export const CHAT_FILE_MAX_BYTES = 5 * 1024 * 1024; // per file
export const CHAT_FILES_TOTAL_BYTES = 200 * 1024 * 1024; // whole company, keeps room for HR data
export const CHAT_FILE_RETENTION_DAYS = 90; // the message stays, the file is removed
// contentType -> allowed extensions. No SVG / HTML: they can run scripts.
export const CHAT_FILE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
};

export const STUDENT_LOAN_PLANS = ['none', 'plan1', 'plan2', 'plan4', 'plan5'];

// Leave that is paid through payroll as statutory pay instead of salary
export const STATUTORY_PAY_TYPES = ['none', 'ssp', 'smp', 'spp'];

export const DEFAULT_UK_PAYROLL = {
  taxYear: '2026/27',
  personalAllowance: 12570,
  // Band widths of taxable pay (after the allowance). England, Wales & NI: basic up to £37,700, higher £37,701-£125,140, additional above
  taxBands: [
    { upTo: 37700, rate: 20 },
    { upTo: 87440, rate: 40 },
    { upTo: null, rate: 45 },
  ],
  // Scottish taxpayers (S codes): starter to £3,967, basic to £16,956, intermediate to £31,092,
  // higher to £62,430, advanced to £125,140, top above
  scottishTaxBands: [
    { upTo: 3967, rate: 19 },
    { upTo: 12989, rate: 20 },
    { upTo: 14136, rate: 21 },
    { upTo: 31338, rate: 42 },
    { upTo: 62710, rate: 45 },
    { upTo: null, rate: 48 },
  ],
  niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270,
  niMainRate: 8,
  niUpperRate: 2,
  niSecondaryThreshold: 5000,
  niEmployerRate: 15,
  pensionLowerLimit: 6240,
  pensionUpperLimit: 50270,
  pensionEmployeeRate: 5,
  pensionEmployerRate: 3,
  studentLoanThresholds: { plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000, postgrad: 21000 },
  studentLoanRate: 9,
  postgradLoanRate: 6,
  // Workplace pension: must auto-enrol workers aged 22 to State Pension age earning over this
  autoEnrolmentTrigger: 10000,
  // Statutory pay (weekly): SSP is the lower of this or 80% of average weekly earnings;
  // SMP after week 6, SPP and SAP are the lower of the flat rate or 90% of average weekly earnings
  sspWeeklyRate: 123.25,
  statutoryFlatRate: 194.32,
  // National Living / Minimum Wage per hour from 1 April 2026
  minimumWage: { age21: 12.71, age18: 10.85, under18: 8, apprentice: 8 },
  // HMRC approved mileage allowance for cars and vans: per mile for the first 10,000 business miles in a tax year, then after
  mileageRate: 0.45,
  mileageRateAfter10k: 0.25,
  mileageThresholdMiles: 10000,
  // Statutory pay rules (law): change only if the law changes
  sspPercent: 80, // SSP = lower of the weekly rate or this % of average weekly earnings
  sspMaxWeeks: 28,
  statutoryPercent: 90, // SMP / SPP: % of average weekly earnings
  smpHigherRateWeeks: 6, // SMP weeks paid at the % above (no cap)
  smpWeeks: 39,
  sppWeeks: 2,
};

/*
 * Company HR policies (Settings -> UK employment policies). Defaults follow common UK practice;
 * set them to what the company's contracts and handbook say (after its employment lawyer's review).
 */
export const DEFAULT_POLICIES = {
  leaveYearStartMonth: 1, // 1 = January-December, 4 = April-March
  leaveBackdateDays: 60, // leave can be requested this many days in the past
  leaveAdvanceDays: 365, // and this far ahead
  regularisationWindowDays: 30,
  expenseClaimWindowDays: 90,
  fitNoteAfterDays: 7, // sickness longer than this (calendar days) needs a fit note
  probationReminderDays: 14,
  rightToWorkFirstReminderDays: 60,
  rightToWorkSecondReminderDays: 30,
  bradfordInformal: 51,
  bradfordWarning: 200,
  bradfordFormal: 500,
  // Company maternity top-up on SMP leave: first N weeks paid at this % of normal pay (0 weeks = statutory only)
  enhancedMaternityWeeks: 0,
  enhancedMaternityPercent: 100,
};

export const ANNOUNCEMENT_CATEGORIES = ['general', 'policy', 'event', 'celebration', 'urgent'];

// ---------- Workforce ----------
// Day status shown on attendance tracking / roster views
export const WORKFORCE_STATUS = [
  'present',
  'late-login',
  'short-login',
  'absent',
  'sick-leave',
  'emergency-leave',
  'approved-leave',
  'weekly-off',
  'holiday',
  'scheduled',
];

// ---------- Performance ----------
// quality = QA score. Adherence is calculated from roster + attendance, not entered.
export const KPI_METRICS = ['quality', 'efficiency', 'classification'];
export const KPI_PERIODS = ['daily', 'weekly'];
export const PERFORMANCE_STATUS = ['meeting-target', 'needs-attention', 'critical'];
export const ACTION_PLAN_STATUS = ['open', 'in-progress', 'completed', 'closed'];
export const RATING_REVIEW_STATUS = ['pending-approval', 'approved', 'disputed'];

// ---------- Quality ----------
export const QA_ERROR_CATEGORIES = [
  'greeting',
  'verification',
  'product-knowledge',
  'resolution',
  'documentation',
  'compliance',
  'soft-skills',
  'hold-transfer',
  'closing',
];
export const INTERACTION_CHANNELS = ['call', 'chat', 'email'];
export const CALIBRATION_STATUS = ['pending', 'scored', 'agreed'];

// ---------- Employee relations ----------
export const WARNING_CATEGORIES = ['attendance', 'performance', 'quality', 'conduct', 'compliance', 'other'];
export const WARNING_STAGES = {
  1: 'Verbal warning',
  2: 'First written warning',
  3: 'Final written warning',
  4: 'Termination review',
};
export const WARNING_STATUS = ['issued', 'acknowledged', 'withdrawn', 'expired'];
export const ESCALATION_STATUS = ['open', 'under-review', 'resolved', 'closed'];
export const TRIGGER_TYPES = ['kpi-failure', 'qa-errors', 'late-logins', 'short-logins', 'absences'];

// ---------- Recruitment ----------
export const JOB_STATUS = ['draft', 'open', 'closed'];
export const APPLICATION_STATUS = [
  'received',
  'under-review',
  'interview-scheduled',
  'selected',
  'rejected',
  'offer-sent',
  'onboarding',
];
export const INTERVIEW_MODES = ['in-person', 'video', 'phone'];
export const INTERVIEW_RESULTS = ['pending', 'passed', 'failed', 'no-show'];
export const DOCUMENT_STATUS = ['requested', 'submitted', 'verified', 'rejected'];

// ---------- Learning ----------
export const TRAINING_STATUS = ['assigned', 'in-progress', 'completed'];

// ---------- Support ----------
export const TICKET_CATEGORIES = ['system-issue', 'access-request', 'software', 'hardware', 'network', 'other'];
export const TICKET_PRIORITY = ['low', 'medium', 'high', 'critical'];
export const TICKET_STATUS = ['open', 'in-progress', 'waiting-on-user', 'resolved', 'closed'];
export const GRIEVANCE_CATEGORIES = ['workplace', 'harassment', 'discrimination', 'pay', 'manager', 'policy', 'other'];
export const GRIEVANCE_STATUS = ['submitted', 'under-review', 'resolved', 'closed'];
export const SUGGESTION_TYPES = ['feedback', 'idea', 'suggestion'];
export const SUGGESTION_STATUS = ['new', 'under-review', 'planned', 'implemented', 'declined'];

// Live Work Status: what an employee is doing right now (agent states / AUX codes)
export const WORK_STATUS_CATEGORIES = ['productive', 'approved', 'system', 'break', 'inactive'];
export const DEFAULT_WORK_STATUSES = [
  { key: 'available', label: 'Available', category: 'productive' },
  { key: 'email', label: 'Email handling', category: 'productive' },
  { key: 'social', label: 'Social media', category: 'productive' },
  { key: 'back-office', label: 'Back office', category: 'productive' },
  { key: 'meeting', label: 'Meeting', category: 'approved' },
  { key: 'training', label: 'Training', category: 'approved' },
  { key: 'coaching', label: 'Coaching / 1:1', category: 'approved' },
  { key: 'it-issue', label: 'IT issue / system down', category: 'system' },
  { key: 'break', label: 'Break', category: 'break' },
  { key: 'lunch', label: 'Lunch', category: 'break' },
  { key: 'away', label: 'Away', category: 'inactive' },
];
