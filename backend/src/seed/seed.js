/*
 * Seeds the database with demo data.
 * WARNING: this clears the existing database first.
 *
 * Run: npm run seed
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import {
  Announcement,
  Asset,
  Attendance,
  Department,
  Designation,
  Expense,
  Goal,
  Holiday,
  LeaveRequest,
  LeaveType,
  PayrollRun,
  Payslip,
  Settings,
  User,
  generateCode,
} from '../models/index.js';
import { addDays, dayOfWeek, todayInTz, zonedTimeToDate } from '../utils/date.js';
import { adjustBalance } from '../services/leave.service.js';
import { getStatusFromMinutes, getLateMinutes } from '../services/attendance.service.js';
import { runPayroll } from '../services/payroll.service.js';
import {
  ANNOUNCEMENTS,
  DEFAULT_PASSWORD,
  DEPARTMENTS,
  DESIGNATIONS,
  EMPLOYEES,
  HOLIDAYS,
  LEAVE_TYPES,
} from './seedData.js';

// Small deterministic random generator so every seed run gives the same data
let randomSeed = 42;
function random() {
  randomSeed = (randomSeed * 16807) % 2147483647;
  return (randomSeed - 1) / 2147483646;
}
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const minutesToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function seedMasters() {
  const settings = await Settings.create({
    companyName: 'Acme Technologies Pvt Ltd',
    companyEmail: 'hello@acme.example',
    companyPhone: '+91 80 4000 1234',
    companyAddress: '4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103',
  });
  const departments = await Department.insertMany(DEPARTMENTS);
  const designations = await Designation.insertMany(DESIGNATIONS);
  const leaveTypes = await LeaveType.insertMany(LEAVE_TYPES);
  await Holiday.insertMany(HOLIDAYS);
  console.log('✓ Settings, departments, designations, leave types, holidays');
  return { settings, departments, designations, leaveTypes };
}

async function seedEmployees({ departments, designations }) {
  const deptByName = Object.fromEntries(departments.map((d) => [d.name, d._id]));
  const desigByTitle = Object.fromEntries(designations.map((d) => [d.title, d._id]));
  const usersByEmail = {};

  // Create in order so managers exist before their reports
  for (const [index, e] of EMPLOYEES.entries()) {
    const user = await User.create({
      employeeCode: await generateCode('employee', 'EMP'),
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      password: DEFAULT_PASSWORD,
      role: e.role,
      gender: e.gender,
      phone: `+91 98${String(76543210 + index * 1111).slice(0, 8)}`,
      dateOfBirth: new Date(e.dateOfBirth),
      dateOfJoining: new Date(e.dateOfJoining),
      maritalStatus: index % 3 === 0 ? 'married' : 'single',
      bloodGroup: ['O+', 'A+', 'B+', 'AB+'][index % 4],
      department: deptByName[e.dept],
      designation: desigByTitle[e.desig],
      reportingManager: e.manager ? usersByEmail[e.manager]._id : null,
      employmentType: e.employmentType || 'full-time',
      workLocation: 'Bengaluru',
      panNumber: `ABCPE${1000 + index}F`,
      address: { line1: `${100 + index}, MG Road`, city: 'Bengaluru', state: 'Karnataka', country: 'India', pincode: '560001' },
      emergencyContact: { name: 'Family Member', relation: 'Parent', phone: '+91 9000000000' },
      bankDetails: {
        accountHolderName: `${e.firstName} ${e.lastName}`,
        accountNumber: `50100${String(23456789 + index * 97)}`,
        bankName: 'HDFC Bank',
        ifsc: 'HDFC0000123',
      },
      salary: { pfApplicable: true, ...e.salary },
    });
    usersByEmail[e.email] = user;
  }

  // Department heads
  await Department.updateOne({ name: 'Engineering' }, { head: usersByEmail['manager@hrms.com']._id });
  await Department.updateOne({ name: 'Human Resources' }, { head: usersByEmail['hr@hrms.com']._id });
  await Department.updateOne({ name: 'Operations' }, { head: usersByEmail['admin@hrms.com']._id });

  console.log(`✓ ${EMPLOYEES.length} employees (password for all: ${DEFAULT_PASSWORD})`);
  return usersByEmail;
}

async function seedLeaves(users, leaveTypes, today) {
  const type = Object.fromEntries(leaveTypes.map((t) => [t.code, t]));
  const approver = users['manager@hrms.com'];

  const leaves = [
    { user: 'employee@hrms.com', code: 'CL', from: addDays(today, -20), to: addDays(today, -20), status: 'approved', reason: 'Family function' },
    { user: 'vikram@hrms.com', code: 'SL', from: addDays(today, -11), to: addDays(today, -10), status: 'approved', reason: 'Fever' },
    { user: 'sneha@hrms.com', code: 'EL', from: addDays(today, 6), to: addDays(today, 8), status: 'pending', reason: 'Vacation with family' },
    { user: 'employee@hrms.com', code: 'CL', from: addDays(today, 12), to: addDays(today, 12), status: 'pending', reason: 'Personal work' },
    { user: 'neha@hrms.com', code: 'SL', from: addDays(today, -5), to: addDays(today, -5), status: 'approved', reason: 'Doctor appointment' },
    { user: 'arjun@hrms.com', code: 'LOP', from: addDays(today, -25), to: addDays(today, -25), status: 'approved', reason: 'Personal emergency' },
  ];

  const leaveDatesByUser = {};
  for (const l of leaves) {
    const user = users[l.user];
    // Skip weekends for simple day counts
    let days = 0;
    for (let d = l.from; d <= l.to; d = addDays(d, 1)) if (![0, 6].includes(dayOfWeek(d))) days += 1;
    if (!days) continue;

    await LeaveRequest.create({
      user: user._id,
      leaveType: type[l.code]._id,
      fromDate: l.from,
      toDate: l.to,
      days,
      reason: l.reason,
      status: l.status,
      ...(l.status === 'approved' ? { reviewedBy: approver._id, reviewedAt: new Date() } : {}),
    });

    const year = Number(l.from.slice(0, 4));
    const bucket = l.status === 'approved' ? { used: days } : { pending: days };
    await adjustBalance(user._id, type[l.code]._id, year, bucket);

    if (l.status === 'approved') {
      leaveDatesByUser[user._id] = leaveDatesByUser[user._id] || new Set();
      for (let d = l.from; d <= l.to; d = addDays(d, 1)) leaveDatesByUser[user._id].add(d);
    }
  }

  console.log(`✓ ${leaves.length} leave requests`);
  return leaveDatesByUser;
}

async function seedAttendance(users, settings, today, leaveDatesByUser) {
  const holidayDates = new Set(HOLIDAYS.filter((h) => h.type !== 'optional').map((h) => h.date));
  const records = [];

  Object.values(users).forEach((user) => {
    const joinDate = user.dateOfJoining.toISOString().slice(0, 10);
    const leaveDates = leaveDatesByUser[user._id] || new Set();

    // Last 75 days, excluding today (users check in live today)
    for (let i = 75; i >= 1; i -= 1) {
      const date = addDays(today, -i);
      if (date < joinDate || settings.weeklyOffs.includes(dayOfWeek(date)) || holidayDates.has(date)) continue;
      if (leaveDates.has(date)) continue;

      const roll = random();
      if (roll < 0.04) continue; // ~4% absent days

      const checkInMinutes = randomInt(9 * 60 + 5, 10 * 60 + 15); // 09:05 - 10:15
      const worked = roll < 0.08 ? randomInt(250, 400) : randomInt(500, 590); // some half days
      const checkOutMinutes = Math.min(checkInMinutes + worked, 23 * 60);
      const lateByMinutes = getLateMinutes(checkInMinutes, settings);

      records.push({
        user: user._id,
        date,
        checkIn: { time: zonedTimeToDate(date, minutesToTime(checkInMinutes), settings.timezone), ip: '127.0.0.1' },
        checkOut: { time: zonedTimeToDate(date, minutesToTime(checkOutMinutes), settings.timezone), ip: '127.0.0.1' },
        workMinutes: worked,
        status: getStatusFromMinutes(worked, settings),
        isLate: lateByMinutes > 0,
        lateByMinutes,
        source: 'web',
      });
    }
  });

  await Attendance.insertMany(records);
  console.log(`✓ ${records.length} attendance records`);
}

async function seedOthers(users, today) {
  const admin = users['admin@hrms.com'];
  const manager = users['manager@hrms.com'];

  await Announcement.insertMany(ANNOUNCEMENTS.map((a) => ({ ...a, createdBy: users['hr@hrms.com']._id })));

  await Expense.insertMany([
    { user: users['arjun@hrms.com']._id, title: 'Client visit - Mumbai flight', category: 'travel', amount: 8450, expenseDate: addDays(today, -9), status: 'pending' },
    { user: users['employee@hrms.com']._id, title: 'Home internet - September', category: 'internet', amount: 1199, expenseDate: addDays(today, -15), status: 'approved', reviewedBy: manager._id, reviewedAt: new Date() },
    { user: users['vikram@hrms.com']._id, title: 'Team lunch', category: 'food', amount: 3200, expenseDate: addDays(today, -4), status: 'pending' },
    { user: users['isha@hrms.com']._id, title: 'Marketing event stationery', category: 'office-supplies', amount: 2150, expenseDate: addDays(today, -30), status: 'reimbursed', reviewedBy: admin._id, reviewedAt: new Date(), reimbursedAt: new Date() },
  ]);

  await Goal.insertMany([
    { user: users['employee@hrms.com']._id, title: 'Ship payments v2 module', description: 'Lead the redesign of the payments flow', dueDate: addDays(today, 60), weightage: 40, progress: 55, status: 'in-progress', createdBy: manager._id },
    { user: users['employee@hrms.com']._id, title: 'Mentor 2 junior engineers', dueDate: addDays(today, 90), weightage: 20, progress: 30, status: 'in-progress', createdBy: manager._id },
    { user: users['vikram@hrms.com']._id, title: 'Improve API test coverage to 80%', dueDate: addDays(today, 45), weightage: 30, progress: 100, status: 'completed', selfRating: 4, selfComment: 'Reached 83% coverage', createdBy: manager._id },
    { user: users['sneha@hrms.com']._id, title: 'Complete AWS certification', dueDate: addDays(today, 75), weightage: 25, progress: 0, status: 'not-started', createdBy: users['sneha@hrms.com']._id },
  ]);

  const assets = [
    { name: 'MacBook Pro 14"', category: 'laptop', brand: 'Apple', serialNumber: 'C02XK1JHMD6R', purchaseDate: '2024-02-10', purchaseCost: 189000, assignedTo: users['employee@hrms.com']._id },
    { name: 'Dell Latitude 5440', category: 'laptop', brand: 'Dell', serialNumber: 'DL5440-88231', purchaseDate: '2023-07-01', purchaseCost: 92000, assignedTo: users['vikram@hrms.com']._id },
    { name: 'Dell 27" Monitor', category: 'monitor', brand: 'Dell', serialNumber: 'P2723QE-1192', purchaseDate: '2024-03-15', purchaseCost: 32000, assignedTo: users['employee@hrms.com']._id },
    { name: 'ThinkPad E14', category: 'laptop', brand: 'Lenovo', serialNumber: 'TPE14-77612', purchaseDate: '2025-01-20', purchaseCost: 68000 },
    { name: 'iPhone 15', category: 'mobile', brand: 'Apple', serialNumber: 'F2LXK8P1Q', purchaseDate: '2024-10-05', purchaseCost: 79900, assignedTo: users['arjun@hrms.com']._id },
  ];
  for (const asset of assets) {
    await Asset.create({
      ...asset,
      assetTag: await generateCode('asset', 'AST'),
      status: asset.assignedTo ? 'assigned' : 'available',
      assignedDate: asset.assignedTo ? asset.purchaseDate : null,
    });
  }

  console.log('✓ Announcements, expenses, goals, assets');
}

async function seedPayroll(users, today) {
  // Process and pay last month's payroll so payslips are visible immediately
  const [year, month] = today.split('-').map(Number);
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastMonthYear = month === 1 ? year - 1 : year;

  const run = await runPayroll({ month: lastMonth, year: lastMonthYear, processedBy: users['hr@hrms.com']._id });
  await PayrollRun.updateOne({ _id: run._id }, { status: 'paid', paidAt: new Date() });
  await Payslip.updateMany({ payrollRun: run._id }, { status: 'paid' });
  console.log(`✓ Payroll for ${lastMonth}/${lastMonthYear} processed and paid (${run.employeeCount} payslips)`);
}

async function seed() {
  await connectDB();
  console.log('Clearing database...');
  await mongoose.connection.dropDatabase();
  // Make sure unique indexes exist before inserting
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));

  const masters = await seedMasters();
  const today = todayInTz(masters.settings.timezone);
  const users = await seedEmployees(masters);
  const leaveDatesByUser = await seedLeaves(users, masters.leaveTypes, today);
  await seedAttendance(users, masters.settings, today, leaveDatesByUser);
  await seedOthers(users, today);
  await seedPayroll(users, today);

  console.log('\nSeed completed. Login accounts:');
  console.log(`  Admin    : admin@hrms.com    / ${DEFAULT_PASSWORD}`);
  console.log(`  HR       : hr@hrms.com       / ${DEFAULT_PASSWORD}`);
  console.log(`  Manager  : manager@hrms.com  / ${DEFAULT_PASSWORD}`);
  console.log(`  Employee : employee@hrms.com / ${DEFAULT_PASSWORD}`);

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
