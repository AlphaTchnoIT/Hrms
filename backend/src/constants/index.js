export const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

// Role groups used by route guards
export const HR_ROLES = [ROLES.ADMIN, ROLES.HR];
export const APPROVER_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER];

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
