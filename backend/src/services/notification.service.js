import nodemailer from 'nodemailer';
import { Notification, User } from '../models/index.js';
import { env } from '../config/env.js';

// Fire-and-forget in-app notification. Never breaks the main request if it fails.
export async function notify(userId, { title, message, link, email = false }) {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, title, message, link });
    if (email) {
      const user = await User.findById(userId).select('email');
      if (user) sendEmail(user.email, title, message);
    }
  } catch (error) {
    console.error('Notification failed:', error.message);
  }
}

export async function notifyMany(userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  await Promise.all(unique.map((id) => notify(id, payload)));
}

/*
 * Sends a notification only once per dedupeKey (used by automatic reminders).
 * Returns true when it was sent now.
 */
export async function notifyOnce(dedupeKey, userId, { title, message, link }) {
  try {
    await Notification.create({ user: userId, title, message, link, dedupeKey });
    return true;
  } catch (error) {
    if (error.code !== 11000) console.error('Reminder failed:', error.message);
    return false;
  }
}

let transporter;
function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/*
 * Email is optional: it is sent only when SMTP_HOST is configured, otherwise it is skipped
 * (in-app notifications still work). Never throws.
 */
export async function sendEmail(to, subject, text) {
  const mailer = getTransporter();
  if (!mailer || !to) {
    if (env.nodeEnv === 'development') console.log(`[email skipped - SMTP not configured] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await mailer.sendMail({ from: env.smtp.from, to, subject, text });
  } catch (error) {
    console.error('Email failed:', error.message);
  }
}
