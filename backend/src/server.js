import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { startReminderJob } from './services/reminder.service.js';
import { initChatSocket } from './chat/chat.socket.js';
import { startChatJobs } from './chat/chat.jobs.js';

// Never die silently: log anything unexpected so it shows in the hosting logs
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('uncaughtException', (error) => console.error('Uncaught exception:', error));

/*
 * Open the port first so the host's port check passes straight away (GET /health works even
 * before the database is up), then connect to MongoDB and start the background jobs.
 */
function start() {
  const server = app.listen(env.port, () => {
    console.log(`HRMS API listening on port ${env.port} (${env.nodeEnv}, Node ${process.version})`);
  });
  // Live chat (Socket.IO) shares the API's port
  initChatSocket(server);

  connectDB().then(() => {
    // Hourly reminders for tests, training, follow-ups, right to work, probation and bank holidays
    if (env.remindersEnabled) startReminderJob();
    startChatJobs(); // removes chat files after 90 days
  });
}

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
start();
