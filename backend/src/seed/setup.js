/*
 * First-time setup for a real company (no demo data).
 * Creates the company settings (UK time, GBP, UK payroll rates), UK leave types, bank holidays
 * for England & Wales, Scotland and Northern Ireland, a few starter departments, default warning
 * triggers and the first admin account with a one-time password.
 *
 * Run:  npm run setup -- --company "Acme Ltd" --email jane@acme.co.uk --first Jane --last Smith
 * Refuses to run when the database already has users (it never deletes anything).
 */
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Department, Holiday, LeaveType, Settings, User, WarningTrigger, generateCode } from '../models/index.js';
import { HOLIDAYS, LEAVE_TYPES, WARNING_TRIGGERS } from './seedData.js';
import { generateTemporaryPassword } from '../utils/password.js';

const STARTER_DEPARTMENTS = [
  { name: 'Operations', code: 'OPS', description: 'Admin and operations' },
  { name: 'Human Resources', code: 'HR', description: 'People operations' },
  { name: 'Finance', code: 'FIN', description: 'Accounts and payroll' },
];

function readOptions() {
  const { values } = parseArgs({
    options: {
      company: { type: 'string' },
      email: { type: 'string' },
      first: { type: 'string' },
      last: { type: 'string', default: '' },
      timezone: { type: 'string', default: 'Europe/London' },
      currency: { type: 'string', default: 'GBP' },
    },
  });
  const missing = ['company', 'email', 'first'].filter((key) => !values[key]);
  if (missing.length) {
    console.error(`Missing --${missing.join(', --')}\nExample: npm run setup -- --company "Acme Ltd" --email jane@acme.co.uk --first Jane --last Smith`);
    process.exit(1);
  }
  if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    console.error('Please give a valid --email');
    process.exit(1);
  }
  return values;
}

async function setup() {
  const options = readOptions();
  await connectDB();

  if (await User.exists({})) {
    console.error('This database already has users. Setup only runs on an empty database (nothing was changed).');
    await mongoose.disconnect();
    process.exit(1);
  }

  await Settings.deleteMany({});
  await Settings.create({ companyName: options.company, companyEmail: options.email, timezone: options.timezone, currency: options.currency.toUpperCase() });

  for (const type of LEAVE_TYPES) await LeaveType.updateOne({ code: type.code }, { $setOnInsert: type }, { upsert: true });
  for (const holiday of HOLIDAYS) await Holiday.updateOne({ date: holiday.date, name: holiday.name }, { $setOnInsert: holiday }, { upsert: true });
  for (const dept of STARTER_DEPARTMENTS) await Department.updateOne({ code: dept.code }, { $setOnInsert: dept }, { upsert: true });
  if (!(await WarningTrigger.exists({}))) await WarningTrigger.insertMany(WARNING_TRIGGERS);

  const temporaryPassword = generateTemporaryPassword();
  await User.create({
    employeeCode: await generateCode('employee', 'EMP'),
    firstName: options.first,
    lastName: options.last,
    email: options.email.toLowerCase(),
    password: temporaryPassword,
    mustChangePassword: true,
    role: 'admin',
    department: (await Department.findOne({ code: 'OPS' }))?._id,
  });

  console.log(`\n✓ ${options.company} is ready (${options.timezone}, ${options.currency.toUpperCase()})`);
  console.log(`✓ ${LEAVE_TYPES.length} UK leave types, ${HOLIDAYS.length} bank holidays, ${STARTER_DEPARTMENTS.length} departments`);
  console.log('\nFirst admin login (shown once, must be changed at first login):');
  console.log(`  Email   : ${options.email.toLowerCase()}`);
  console.log(`  Password: ${temporaryPassword}`);
  console.log('\nNext: log in, check Settings (company details, UK payroll rates, modules, privacy notice), then add employees.');
  await mongoose.disconnect();
}

setup().catch(async (error) => {
  console.error('Setup failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
