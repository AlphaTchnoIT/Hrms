export const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  QA: 'qa',
  IT: 'it',
};

export const HR_ROLES = [ROLES.ADMIN, ROLES.HR];
export const APPROVER_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER];
export const AUDITOR_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.QA];
export const QA_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.QA];
export const IT_ROLES = [ROLES.ADMIN, ROLES.IT];

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'fixed-term', 'zero-hours', 'contract', 'apprentice', 'intern'];

// UK payroll options
export const NI_CATEGORIES = [
  { value: 'A', label: 'A – Standard' },
  { value: 'M', label: 'M – Under 21' },
  { value: 'H', label: 'H – Apprentice under 25' },
  { value: 'C', label: 'C – Over State Pension age' },
  { value: 'X', label: 'X – Not liable' },
];
export const STUDENT_LOAN_PLANS = [
  { value: 'none', label: 'None' },
  { value: 'plan1', label: 'Plan 1' },
  { value: 'plan2', label: 'Plan 2' },
  { value: 'plan4', label: 'Plan 4 (Scotland)' },
  { value: 'plan5', label: 'Plan 5' },
];
export const EMPLOYEE_STATUS = ['active', 'inactive', 'terminated'];
export const GENDERS = ['male', 'female', 'other'];
export const MARITAL_STATUS = ['single', 'married', 'divorced', 'widowed'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const EXPENSE_CATEGORIES = ['travel', 'food', 'accommodation', 'office-supplies', 'internet', 'other'];
export const GOAL_STATUS = ['not-started', 'in-progress', 'completed'];
export const ASSET_CATEGORIES = ['laptop', 'desktop', 'monitor', 'mobile', 'accessory', 'furniture', 'other'];
export const ASSET_STATUS = ['available', 'assigned', 'maintenance', 'retired'];
export const HOLIDAY_TYPES = ['bank-holiday', 'regional', 'optional', 'company'];
export const ANNOUNCEMENT_CATEGORIES = ['general', 'policy', 'event', 'celebration', 'urgent'];
export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Badge colour for every status string used in the app
export const STATUS_COLORS = {
  // requests
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
  reimbursed: 'blue',
  // attendance
  present: 'green',
  'half-day': 'yellow',
  absent: 'red',
  leave: 'purple',
  'on-leave': 'purple',
  holiday: 'blue',
  'bank-holiday': 'blue',
  regional: 'purple',
  'weekly-off': 'gray',
  'checked-in': 'blue',
  'not-checked-in': 'gray',
  'not-employed': 'gray',
  today: 'blue',
  upcoming: 'gray',
  // employees
  active: 'green',
  inactive: 'yellow',
  terminated: 'red',
  // payroll
  processed: 'yellow',
  paid: 'green',
  // goals
  'not-started': 'gray',
  'in-progress': 'blue',
  completed: 'green',
  // assets
  available: 'green',
  assigned: 'blue',
  maintenance: 'yellow',
  retired: 'gray',
  // roles
  admin: 'red',
  hr: 'purple',
  manager: 'blue',
  employee: 'gray',
  qa: 'blue',
  it: 'blue',
  // workforce
  'late-login': 'yellow',
  'short-login': 'yellow',
  'sick-leave': 'purple',
  'emergency-leave': 'purple',
  'approved-leave': 'purple',
  scheduled: 'gray',
  // performance
  'meeting-target': 'green',
  'needs-attention': 'yellow',
  critical: 'red',
  'no-data': 'gray',
  open: 'blue',
  closed: 'gray',
  'pending-approval': 'yellow',
  disputed: 'red',
  'target-achieved': 'green',
  'on-track': 'green',
  improving: 'blue',
  'off-track': 'red',
  // quality / relations
  scored: 'blue',
  agreed: 'green',
  issued: 'red',
  acknowledged: 'green',
  withdrawn: 'gray',
  expired: 'gray',
  'under-review': 'yellow',
  resolved: 'green',
  // recruitment
  draft: 'gray',
  received: 'blue',
  'interview-scheduled': 'purple',
  selected: 'green',
  'offer-sent': 'green',
  onboarding: 'green',
  requested: 'yellow',
  submitted: 'blue',
  verified: 'green',
  passed: 'green',
  failed: 'red',
  'no-show': 'red',
  // learning / support
  overdue: 'red',
  'waiting-on-user': 'yellow',
  new: 'blue',
  planned: 'purple',
  implemented: 'green',
  declined: 'gray',
  low: 'gray',
  medium: 'blue',
  high: 'yellow',
};

// ---------- Workforce / performance ----------
export const KPI_METRICS = ['quality', 'efficiency', 'classification'];
export const ALL_METRICS = ['quality', 'efficiency', 'classification', 'adherence'];
export const METRIC_LABELS = { quality: 'Quality (QA)', efficiency: 'Efficiency', classification: 'Classification', adherence: 'Shift adherence' };
export const METRIC_COLORS = { quality: '#6366f1', efficiency: '#10b981', classification: '#f59e0b', adherence: '#0ea5e9' };
export const RATING_LABELS = { 1: 'Unsatisfactory', 2: 'Needs improvement', 3: 'Meets most', 4: 'Meets expectations', 5: 'Exceeds expectations' };
export const ACTION_PLAN_STATUS = ['open', 'in-progress', 'completed', 'closed'];
export const SHIFT_PRESETS = [
  { shiftName: 'Morning', startTime: '07:00', endTime: '16:00' },
  { shiftName: 'General', startTime: '09:30', endTime: '18:30' },
  { shiftName: 'Evening', startTime: '13:00', endTime: '22:00' },
  { shiftName: 'Night', startTime: '22:00', endTime: '07:00' },
];

// ---------- Quality / relations ----------
export const QA_ERROR_CATEGORIES = ['greeting', 'verification', 'product-knowledge', 'resolution', 'documentation', 'compliance', 'soft-skills', 'hold-transfer', 'closing'];
export const INTERACTION_CHANNELS = ['call', 'chat', 'email'];
export const WARNING_CATEGORIES = ['attendance', 'performance', 'quality', 'conduct', 'compliance', 'other'];
export const WARNING_STAGES = { 1: 'Verbal warning', 2: 'First written warning', 3: 'Final written warning', 4: 'Termination review' };
export const ESCALATION_STATUS = ['open', 'under-review', 'resolved', 'closed'];
export const TRIGGER_TYPES = ['kpi-failure', 'qa-errors', 'late-logins', 'short-logins', 'absences'];

// ---------- Recruitment ----------
export const JOB_STATUS = ['draft', 'open', 'closed'];
export const APPLICATION_STATUS = ['received', 'under-review', 'interview-scheduled', 'selected', 'rejected', 'offer-sent', 'onboarding'];
export const INTERVIEW_MODES = ['in-person', 'video', 'phone'];
export const INTERVIEW_RESULTS = ['pending', 'passed', 'failed', 'no-show'];

// ---------- Support ----------
export const TICKET_CATEGORIES = ['system-issue', 'access-request', 'software', 'hardware', 'network', 'other'];
export const TICKET_PRIORITY = ['low', 'medium', 'high', 'critical'];
export const TICKET_STATUS = ['open', 'in-progress', 'waiting-on-user', 'resolved', 'closed'];
export const GRIEVANCE_CATEGORIES = ['workplace', 'harassment', 'discrimination', 'pay', 'manager', 'policy', 'other'];
export const GRIEVANCE_STATUS = ['submitted', 'under-review', 'resolved', 'closed'];
export const SUGGESTION_TYPES = ['feedback', 'idea', 'suggestion'];
export const SUGGESTION_STATUS = ['new', 'under-review', 'planned', 'implemented', 'declined'];
