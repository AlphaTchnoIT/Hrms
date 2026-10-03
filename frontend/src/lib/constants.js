export const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

export const HR_ROLES = [ROLES.ADMIN, ROLES.HR];
export const APPROVER_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER];

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'intern'];
export const EMPLOYEE_STATUS = ['active', 'inactive', 'terminated'];
export const GENDERS = ['male', 'female', 'other'];
export const MARITAL_STATUS = ['single', 'married', 'divorced', 'widowed'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const EXPENSE_CATEGORIES = ['travel', 'food', 'accommodation', 'office-supplies', 'internet', 'other'];
export const GOAL_STATUS = ['not-started', 'in-progress', 'completed'];
export const ASSET_CATEGORIES = ['laptop', 'desktop', 'monitor', 'mobile', 'accessory', 'furniture', 'other'];
export const ASSET_STATUS = ['available', 'assigned', 'maintenance', 'retired'];
export const HOLIDAY_TYPES = ['national', 'festival', 'optional', 'company'];
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
};
