import { User } from '../models/index.js';
import { HR_ROLES, ROLES } from '../constants/index.js';

export function isHR(user) {
  return HR_ROLES.includes(user.role);
}

// IDs of employees who report directly to this manager
export async function getTeamMemberIds(managerId) {
  return User.find({ reportingManager: managerId }).distinct('_id');
}

/*
 * Which employees can the logged-in user see in approval / team screens?
 * - admin & hr: everyone (returns null = no filter)
 * - manager: own direct reports
 * - employee: nobody
 */
export async function getManagedUserFilter(user) {
  if (isHR(user)) return null;
  if (user.role === ROLES.MANAGER) return { $in: await getTeamMemberIds(user._id) };
  return { $in: [] };
}

// Can the logged-in user view/act on data belonging to employeeId?
export async function canManageEmployee(user, employeeId) {
  if (isHR(user)) return true;
  if (user.role !== ROLES.MANAGER) return false;
  const employee = await User.findById(employeeId).select('reportingManager');
  return Boolean(employee && String(employee.reportingManager) === String(user._id));
}
