/*
 * Safe upgrade for an existing database (does NOT delete anything).
 * Adds what the new modules need, only if it is missing:
 *   - Quality & IT Support departments, QA Auditor & IT Support Engineer designations
 *   - Emergency Leave type
 *   - QA and IT demo accounts (qa@hrms.com, it@hrms.com)
 *   - Default warning triggers (only when there are none)
 *
 * Run: npm run seed:upgrade
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Department, Designation, LeaveType, User, WarningTrigger, generateCode } from '../models/index.js';
import { DEFAULT_PASSWORD, DEPARTMENTS, DESIGNATIONS, EMPLOYEES, LEAVE_TYPES, WARNING_TRIGGERS } from './seedData.js';

const NEW_DEPARTMENTS = ['Quality', 'IT Support'];
const NEW_DESIGNATIONS = ['QA Auditor', 'IT Support Engineer'];
const NEW_LEAVE_TYPES = ['EML'];
const NEW_USERS = ['qa@hrms.com', 'it@hrms.com'];

async function upgrade() {
  await connectDB();

  for (const dept of DEPARTMENTS.filter((d) => NEW_DEPARTMENTS.includes(d.name))) {
    if (!(await Department.exists({ $or: [{ name: dept.name }, { code: dept.code }] }))) {
      await Department.create(dept);
      console.log(`✓ Department added: ${dept.name}`);
    }
  }

  for (const desig of DESIGNATIONS.filter((d) => NEW_DESIGNATIONS.includes(d.title))) {
    if (!(await Designation.exists({ title: desig.title }))) {
      await Designation.create(desig);
      console.log(`✓ Designation added: ${desig.title}`);
    }
  }

  for (const type of LEAVE_TYPES.filter((t) => NEW_LEAVE_TYPES.includes(t.code))) {
    if (!(await LeaveType.exists({ $or: [{ code: type.code }, { name: type.name }] }))) {
      await LeaveType.create(type);
      console.log(`✓ Leave type added: ${type.name}`);
    }
  }

  for (const e of EMPLOYEES.filter((emp) => NEW_USERS.includes(emp.email))) {
    if (await User.exists({ email: e.email })) {
      console.log(`- ${e.email} already exists, left unchanged`);
      continue;
    }
    const [department, designation, manager] = await Promise.all([
      Department.findOne({ name: e.dept }).select('_id'),
      Designation.findOne({ title: e.desig }).select('_id'),
      e.manager ? User.findOne({ email: e.manager }).select('_id') : null,
    ]);
    await User.create({
      employeeCode: await generateCode('employee', 'EMP'),
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      password: DEFAULT_PASSWORD,
      role: e.role,
      gender: e.gender,
      dateOfBirth: new Date(e.dateOfBirth),
      dateOfJoining: new Date(e.dateOfJoining),
      department: department?._id || null,
      designation: designation?._id || null,
      reportingManager: manager?._id || null,
      workLocation: 'Bengaluru',
      salary: { pfApplicable: true, ...e.salary },
    });
    console.log(`✓ User added: ${e.email} (${e.role}) / ${DEFAULT_PASSWORD}`);
  }

  if (!(await WarningTrigger.exists({}))) {
    await WarningTrigger.insertMany(WARNING_TRIGGERS);
    console.log(`✓ ${WARNING_TRIGGERS.length} default warning triggers added`);
  }

  console.log('\nUpgrade completed. Nothing was deleted.');
  await mongoose.disconnect();
}

upgrade().catch(async (error) => {
  console.error('Upgrade failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
