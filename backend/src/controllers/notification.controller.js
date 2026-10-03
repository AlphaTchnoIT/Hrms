import { Notification } from '../models/index.js';
import { sendSuccess } from '../utils/response.js';

// GET /api/notifications - latest 30 + unread count
export async function listNotifications(req, res) {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  sendSuccess(res, { data: { items, unreadCount } });
}

export async function markAsRead(req, res) {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { isRead: true });
  sendSuccess(res, { message: 'Marked as read' });
}

export async function markAllAsRead(req, res) {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  sendSuccess(res, { message: 'All notifications marked as read' });
}
