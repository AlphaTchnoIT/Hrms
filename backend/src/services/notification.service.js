import { Notification } from '../models/index.js';

// Fire-and-forget in-app notification. Never breaks the main request if it fails.
export async function notify(userId, { title, message, link }) {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, title, message, link });
  } catch (error) {
    console.error('Notification failed:', error.message);
  }
}
