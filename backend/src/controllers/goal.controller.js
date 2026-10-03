import { Goal } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { canManageEmployee, getManagedUserFilter } from '../services/access.service.js';
import { notify } from '../services/notification.service.js';

const OWNER_FIELDS = ['title', 'description', 'startDate', 'dueDate', 'weightage', 'progress', 'status', 'selfRating', 'selfComment'];
const MANAGER_FIELDS = [...OWNER_FIELDS, 'managerRating', 'managerComment'];
const GOAL_POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'createdBy', select: 'firstName lastName' },
];

// Keep status in sync with progress
function syncStatus(goal) {
  if (goal.progress >= 100) goal.status = 'completed';
  else if (goal.progress > 0 && goal.status === 'not-started') goal.status = 'in-progress';
}

// GET /api/goals/my
export async function getMyGoals(req, res) {
  const goals = await Goal.find({ user: req.user._id }).populate(GOAL_POPULATE).sort({ createdAt: -1 });
  sendSuccess(res, { data: goals });
}

// GET /api/goals?user=  (HR / manager)
export async function listGoals(req, res) {
  const filter = {};
  const managed = await getManagedUserFilter(req.user);
  if (managed) filter.user = managed;

  if (req.query.user) {
    if (!(await canManageEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    filter.user = req.query.user;
  }
  if (req.query.status) filter.status = req.query.status;

  const goals = await Goal.find(filter).populate(GOAL_POPULATE).sort({ createdAt: -1 }).limit(500);
  sendSuccess(res, { data: goals });
}

// POST /api/goals - for yourself, or (manager/HR) for a team member via body.user
export async function createGoal(req, res) {
  const targetUser = req.body.user || String(req.user._id);
  const forSelf = targetUser === String(req.user._id);
  if (!forSelf && !(await canManageEmployee(req.user, targetUser))) throw ApiError.forbidden();

  const goal = new Goal({ ...pick(req.body, OWNER_FIELDS), user: targetUser, createdBy: req.user._id });
  syncStatus(goal);
  await goal.save();

  if (!forSelf) {
    notify(targetUser, { title: 'New goal assigned', message: `"${goal.title}" was assigned to you`, link: '/performance' });
  }

  sendSuccess(res, { data: goal, message: 'Goal created', status: 201 });
}

// PUT /api/goals/:id
export async function updateGoal(req, res) {
  const goal = await Goal.findById(req.params.id);
  if (!goal) throw ApiError.notFound('Goal not found');

  const isOwner = String(goal.user) === String(req.user._id);
  const isManager = !isOwner && (await canManageEmployee(req.user, goal.user));
  if (!isOwner && !isManager) throw ApiError.forbidden();

  goal.set(pick(req.body, isManager ? MANAGER_FIELDS : OWNER_FIELDS));
  syncStatus(goal);
  await goal.save();

  if (isManager && req.body.managerRating) {
    notify(goal.user, { title: 'Goal reviewed', message: `Your manager reviewed "${goal.title}"`, link: '/performance' });
  }

  sendSuccess(res, { data: goal, message: 'Goal updated' });
}

// DELETE /api/goals/:id
export async function deleteGoal(req, res) {
  const goal = await Goal.findById(req.params.id);
  if (!goal) throw ApiError.notFound('Goal not found');

  const isOwner = String(goal.user) === String(req.user._id);
  if (!isOwner && !(await canManageEmployee(req.user, goal.user))) throw ApiError.forbidden();

  await goal.deleteOne();
  sendSuccess(res, { message: 'Goal deleted' });
}
