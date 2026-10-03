import { Settings } from '../models/index.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';

const FIELDS = [
  'companyName',
  'companyEmail',
  'companyPhone',
  'companyAddress',
  'timezone',
  'currency',
  'officeStartTime',
  'officeEndTime',
  'graceMinutes',
  'halfDayMinutes',
  'fullDayMinutes',
  'weeklyOffs',
  'requireLocationForCheckIn',
  'pfRate',
  'pfCeiling',
  'professionalTax',
  'attendanceBasedLop',
];

export async function getSettings(_req, res) {
  sendSuccess(res, { data: await Settings.getSettings() });
}

export async function updateSettings(req, res) {
  const body = pick(req.body, FIELDS);

  const settings = await Settings.getSettings();
  settings.set(body);
  await settings.save();
  sendSuccess(res, { data: settings, message: 'Settings saved' });
}
