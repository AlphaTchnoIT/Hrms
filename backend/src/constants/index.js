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

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'intern'];
export const EMPLOYEE_STATUS = ['active', 'inactive', 'terminated'];

export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const ATTENDANCE_STATUS = ['present', 'half-day', 'absent'];

export const EXPENSE_CATEGORIES = ['travel', 'food', 'accommodation', 'office-supplies', 'internet', 'other'];
export const EXPENSE_STATUS = ['pending', 'approved', 'rejected', 'reimbursed'];

export const GOAL_STATUS = ['not-started', 'in-progress', 'completed'];

export const ASSET_CATEGORIES = ['laptop', 'desktop', 'monitor', 'mobile', 'accessory', 'furniture', 'other'];
export const ASSET_STATUS = ['available', 'assigned', 'maintenance', 'retired'];

export const HOLIDAY_TYPES = ['national', 'festival', 'optional', 'company'];

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
