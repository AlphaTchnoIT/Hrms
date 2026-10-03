import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { startReminderJob } from './services/reminder.service.js';

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`HRMS API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
  // Hourly reminders for knowledge tests, training, follow-ups and interviews
  if (env.remindersEnabled) startReminderJob();
}

start();
