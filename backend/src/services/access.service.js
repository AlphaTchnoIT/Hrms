import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { HR_ROLES, ROLES } from '../constants/index.js';

// Safety cap while walking the reporting chain (also stops bad data from looping forever)
const MAX_DEPTH = 25;

export function isHR(user) {
  return HR_ROLES.includes(user.role);
}

/*
 * Manager access comes from the reporting line, not only from the role:
 * anyone with active reportees (e.g. a Team Lead with the "employee" role) gets the manager workspace.
 * `hasReportees` is set on req.user by the auth middleware.
 */
export function isManager(user) {
  return user.role === ROLES.MANAGER || Boolean(user.$locals?.hasReportees);
}

export function hasActiveReportees(userId) {
  return User.exists({ reportingManager: userId, status: 'active' }).then(Boolean);
}

// Roles the user acts as, e.g. an employee who leads a team -> ['employee', 'manager']
export function getAccessRoles(user) {
  const roles = [user.role];
  if (user.role !== ROLES.MANAGER && !isHR(user) && isManager(user)) roles.push(ROLES.MANAGER);
  return roles;
}

/*
 * IDs of employees under this manager.
 * - scope 'direct': people who report to them directly
 * - scope 'all': the whole chain below them (direct + indirect reportees)
 */
export async function getTeamMemberIds(managerId, { scope = 'direct' } = {}) {
  if (scope !== 'all') return User.find({ reportingManager: managerId }).distinct('_id');

  const [result] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(managerId)) } },
    {
      $graphLookup: {
        from: User.collection.name,
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'reportingManager',
        as: 'reportees',
        maxDepth: MAX_DEPTH,
      },
    },
    { $project: { ids: '$reportees._id' } },
  ]);
  return (result?.ids || []).filter((id) => String(id) !== String(managerId));
}

// Number of active direct and total (direct + indirect) reportees
export async function getTeamSize(userId) {
  const all = await getTeamMemberIds(userId, { scope: 'all' });
  if (!all.length) return { direct: 0, all: 0 };
  const [direct, total] = await Promise.all([
    User.countDocuments({ reportingManager: userId, status: 'active' }),
    User.countDocuments({ _id: { $in: all }, status: 'active' }),
  ]);
  return { direct, all: total };
}

// Is `employeeId` somewhere below `managerId` in the reporting chain?
export async function isInReportingChain(managerId, employeeId) {
  let current = await User.findById(employeeId).select('reportingManager').lean();
  const seen = new Set();
  for (let depth = 0; current?.reportingManager && depth < MAX_DEPTH; depth += 1) {
    const parentId = String(current.reportingManager);
    if (parentId === String(managerId)) return true;
    if (seen.has(parentId)) return false;
    seen.add(parentId);
    current = await User.findById(parentId).select('reportingManager').lean();
  }
  return false;
}

/*
 * Which employees can the logged-in user see in approval / team screens?
 * - admin & hr: everyone (returns null = no filter)
 * - manager / team lead: own reportees (direct by default, whole chain with scope 'all')
 * - employee: nobody
 */
export async function getManagedUserFilter(user, { scope } = {}) {
  if (isHR(user)) return null;
  if (isManager(user)) return { $in: await getTeamMemberIds(user._id, { scope }) };
  return { $in: [] };
}

// Can the logged-in user view/act on data belonging to employeeId? Managers can act on their whole chain.
export async function canManageEmployee(user, employeeId) {
  if (isHR(user)) return true;
  if (!isManager(user) || !employeeId) return false;
  return isInReportingChain(user._id, employeeId);
}

export function isQA(user) {
  return user.role === ROLES.QA;
}

/*
 * Active employees the logged-in user may look at in team screens.
 * - HR/admin/QA: everyone, or only one manager's team when managerId is given
 * - manager / team lead: own reportees
 * - others: nobody
 * scope 'all' includes indirect reportees as well.
 */
export async function getScopedUsers(user, { managerId, scope, select = 'firstName lastName employeeCode avatar role reportingManager dateOfJoining department designation holidayRegion' } = {}) {
  const filter = { status: 'active' };
  const teamOf = async (id) => (scope === 'all' ? { _id: { $in: await getTeamMemberIds(id, { scope }) } } : { reportingManager: id });

  if (isHR(user) || isQA(user)) {
    if (managerId) Object.assign(filter, await teamOf(managerId));
  } else if (isManager(user)) {
    // A manager may narrow down to one of their team leads' teams
    const ownTeamLead = managerId && String(managerId) !== String(user._id) && (await isInReportingChain(user._id, managerId));
    Object.assign(filter, await teamOf(ownTeamLead ? managerId : user._id));
  } else {
    return [];
  }
  return User.find(filter).select(select).populate('designation', 'title').sort({ firstName: 1 });
}

// QA auditors can audit any active employee; others follow the normal manager rules
export async function canAuditEmployee(user, employeeId) {
  if (isQA(user)) return Boolean(await User.exists({ _id: employeeId, status: 'active' }));
  return canManageEmployee(user, employeeId);
}

// Would making `managerId` the reporting manager of `employeeId` create a loop?
export async function wouldCreateReportingLoop(employeeId, managerId) {
  if (!managerId) return false;
  if (String(employeeId) === String(managerId)) return true;
  return isInReportingChain(employeeId, managerId);
}
