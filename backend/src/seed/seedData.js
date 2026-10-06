// Static demo data used by seed.js

export const DEPARTMENTS = [
  { name: 'Engineering', code: 'ENG', description: 'Product development and engineering' },
  { name: 'Human Resources', code: 'HR', description: 'People operations and talent' },
  { name: 'Sales', code: 'SAL', description: 'Business development and sales' },
  { name: 'Marketing', code: 'MKT', description: 'Brand, content and growth' },
  { name: 'Finance', code: 'FIN', description: 'Accounts and finance' },
  { name: 'Operations', code: 'OPS', description: 'Admin and operations' },
  { name: 'Quality', code: 'QA', description: 'Quality assurance and audits' },
  { name: 'IT Support', code: 'IT', description: 'Internal IT helpdesk' },
];

export const DESIGNATIONS = [
  { title: 'Chief Executive Officer', level: 6 },
  { title: 'Engineering Manager', level: 5 },
  { title: 'HR Manager', level: 5 },
  { title: 'Team Lead', level: 4 },
  { title: 'Senior Software Engineer', level: 4 },
  { title: 'Software Engineer', level: 3 },
  { title: 'HR Executive', level: 3 },
  { title: 'Sales Executive', level: 3 },
  { title: 'Marketing Executive', level: 3 },
  { title: 'Accountant', level: 3 },
  { title: 'Intern', level: 1 },
  { title: 'QA Auditor', level: 3 },
  { title: 'IT Support Engineer', level: 3 },
];

// UK leave: 25 days annual leave (plus bank holidays), company sick pay and statutory-style leave
export const LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'AL', annualQuota: 25, isPaid: true, color: '#10b981', description: 'Holiday entitlement, on top of bank holidays' },
  { name: 'Sick Leave', code: 'SL', annualQuota: 10, isPaid: true, color: '#ef4444', description: 'Company sick pay when you are unwell' },
  { name: 'Compassionate Leave', code: 'CPL', annualQuota: 5, isPaid: true, color: '#8b5cf6', description: 'Bereavement or serious family illness' },
  { name: 'Time Off for Dependants', code: 'TOD', annualQuota: 3, isPaid: true, color: '#f97316', description: 'Unexpected emergencies involving a dependant' },
  { name: "Carer's Leave", code: 'CRL', annualQuota: 5, isPaid: false, color: '#0ea5e9', description: 'To care for a dependant with a long-term need' },
  { name: 'Unpaid Leave', code: 'UL', annualQuota: 0, isPaid: false, color: '#64748b', description: 'Agreed time off without pay' },
];

// Bank holidays in England & Wales (2026 and 2027)
export const HOLIDAYS = [
  { name: "New Year's Day", date: '2026-01-01', type: 'bank-holiday' },
  { name: 'Good Friday', date: '2026-04-03', type: 'bank-holiday' },
  { name: 'Easter Monday', date: '2026-04-06', type: 'bank-holiday' },
  { name: 'Early May bank holiday', date: '2026-05-04', type: 'bank-holiday' },
  { name: 'Spring bank holiday', date: '2026-05-25', type: 'bank-holiday' },
  { name: 'Summer bank holiday', date: '2026-08-31', type: 'bank-holiday' },
  { name: 'Christmas Day', date: '2026-12-25', type: 'bank-holiday' },
  { name: 'Boxing Day (substitute day)', date: '2026-12-28', type: 'bank-holiday' },
  { name: 'Company Wellbeing Day', date: '2026-12-24', type: 'company' },
  { name: "New Year's Day", date: '2027-01-01', type: 'bank-holiday' },
  { name: 'Good Friday', date: '2027-03-26', type: 'bank-holiday' },
  { name: 'Easter Monday', date: '2027-03-29', type: 'bank-holiday' },
  { name: 'Early May bank holiday', date: '2027-05-03', type: 'bank-holiday' },
  { name: 'Spring bank holiday', date: '2027-05-31', type: 'bank-holiday' },
  { name: 'Summer bank holiday', date: '2027-08-30', type: 'bank-holiday' },
  { name: 'Christmas Day (substitute day)', date: '2027-12-27', type: 'bank-holiday' },
  { name: 'Boxing Day (substitute day)', date: '2027-12-28', type: 'bank-holiday' },
];

export const DEFAULT_PASSWORD = 'Password@123';

/*
 * People. "dept" and "desig" are matched by name, "manager" by email.
 * Pay is UK PAYE: annual salary in GBP, tax code, NI category, pension, student loan.
 */
export const EMPLOYEES = [
  {
    firstName: 'Oliver', lastName: 'Bennett', email: 'admin@hrms.com', role: 'admin', gender: 'male',
    dept: 'Operations', desig: 'Chief Executive Officer', dateOfJoining: '2020-04-01', dateOfBirth: '1980-06-15',
    salary: { annualSalary: 120000, taxCode: '1257L' },
  },
  {
    firstName: 'Charlotte', lastName: 'Hughes', email: 'hr@hrms.com', role: 'hr', gender: 'female',
    dept: 'Human Resources', desig: 'HR Manager', manager: 'admin@hrms.com', dateOfJoining: '2021-01-11', dateOfBirth: '1988-10-12',
    salary: { annualSalary: 52000, taxCode: '1257L' },
  },
  {
    firstName: 'James', lastName: 'Wilson', email: 'manager@hrms.com', role: 'manager', gender: 'male',
    dept: 'Engineering', desig: 'Engineering Manager', manager: 'admin@hrms.com', dateOfJoining: '2021-06-01', dateOfBirth: '1986-02-20',
    salary: { annualSalary: 78000, taxCode: '1257L' },
  },
  {
    firstName: 'Emily', lastName: 'Clarke', email: 'employee@hrms.com', role: 'employee', gender: 'female',
    dept: 'Engineering', desig: 'Senior Software Engineer', manager: 'manager@hrms.com', dateOfJoining: '2022-03-14', dateOfBirth: '1994-10-08',
    salary: { annualSalary: 62000, taxCode: '1257L', studentLoanPlan: 'plan2' },
  },
  {
    firstName: 'Thomas', lastName: 'Wright', email: 'thomas@hrms.com', role: 'employee', gender: 'male',
    dept: 'Engineering', desig: 'Team Lead', manager: 'manager@hrms.com', dateOfJoining: '2023-07-03', dateOfBirth: '1992-12-01',
    salary: { annualSalary: 58000, taxCode: '1257L' },
  },
  {
    firstName: 'Sophie', lastName: 'Martin', email: 'sophie@hrms.com', role: 'employee', gender: 'female',
    dept: 'Engineering', desig: 'Software Engineer', manager: 'thomas@hrms.com', dateOfJoining: '2024-01-15', dateOfBirth: '1998-10-25',
    salary: { annualSalary: 42000, taxCode: '1257L', studentLoanPlan: 'plan2' },
  },
  {
    firstName: 'Harry', lastName: 'Evans', email: 'harry@hrms.com', role: 'employee', gender: 'male',
    dept: 'Engineering', desig: 'Intern', manager: 'thomas@hrms.com', employmentType: 'intern', dateOfJoining: '2026-09-07', dateOfBirth: '2005-05-17',
    salary: { annualSalary: 24000, taxCode: '1257L', niCategory: 'M', studentLoanPlan: 'plan5' },
  },
  {
    firstName: 'Grace', lastName: 'Walker', email: 'grace@hrms.com', role: 'employee', gender: 'female',
    dept: 'Human Resources', desig: 'HR Executive', manager: 'hr@hrms.com', dateOfJoining: '2023-02-01', dateOfBirth: '1996-08-30',
    salary: { annualSalary: 31000, taxCode: '1257L' },
  },
  {
    firstName: 'Jack', lastName: 'Robinson', email: 'jack@hrms.com', role: 'employee', gender: 'male',
    dept: 'Sales', desig: 'Sales Executive', manager: 'admin@hrms.com', dateOfJoining: '2022-09-19', dateOfBirth: '1993-11-11',
    salary: { annualSalary: 34000, monthlyAllowance: 300, taxCode: '1257L' },
  },
  {
    firstName: 'Amelia', lastName: 'Hall', email: 'amelia@hrms.com', role: 'employee', gender: 'female',
    dept: 'Marketing', desig: 'Marketing Executive', manager: 'admin@hrms.com', dateOfJoining: '2023-11-06', dateOfBirth: '1995-04-04',
    salary: { annualSalary: 33000, taxCode: '1257L', studentLoanPlan: 'plan1' },
  },
  {
    firstName: 'George', lastName: 'King', email: 'george@hrms.com', role: 'employee', gender: 'male',
    dept: 'Finance', desig: 'Accountant', manager: 'admin@hrms.com', dateOfJoining: '2021-10-04', dateOfBirth: '1990-10-05',
    salary: { annualSalary: 45000, taxCode: '1257L', postgraduateLoan: true },
  },
  {
    firstName: 'Olivia', lastName: 'Scott', email: 'qa@hrms.com', role: 'qa', gender: 'female',
    dept: 'Quality', desig: 'QA Auditor', manager: 'hr@hrms.com', dateOfJoining: '2022-05-02', dateOfBirth: '1992-07-21',
    workLocation: 'Glasgow (remote)', salary: { annualSalary: 36000, taxCode: 'S1257L' },
  },
  {
    firstName: 'Daniel', lastName: 'Green', email: 'it@hrms.com', role: 'it', gender: 'male',
    dept: 'IT Support', desig: 'IT Support Engineer', manager: 'admin@hrms.com', dateOfJoining: '2023-04-10', dateOfBirth: '1994-01-30',
    salary: { annualSalary: 35000, taxCode: '1257L' },
  },
];

export const ANNOUNCEMENTS = [
  {
    title: 'Welcome to our new HRMS portal 🎉',
    content: 'All attendance, leave, payslips and expense claims are now managed here. Please complete your profile and use web check-in daily.',
    category: 'general',
    isPinned: true,
  },
  {
    title: 'Updated Work From Home Policy',
    content: 'Employees can now work from home up to 2 days a week with manager approval. Remember to check in from the portal on WFH days too.',
    category: 'policy',
  },
  {
    title: 'Christmas party on Friday 18th December',
    content: 'Join us for the team Christmas party at the office from 5 PM. Food, drinks and Secret Santa — please bring a gift up to £15!',
    category: 'event',
  },
];

// Default warning triggers (editable by HR)
export const WARNING_TRIGGERS = [
  { name: 'Repeated late logins', type: 'late-logins', threshold: 4, windowDays: 30, category: 'attendance' },
  { name: 'Unplanned absences', type: 'absences', threshold: 2, windowDays: 30, category: 'attendance' },
  { name: 'Efficiency below target', type: 'kpi-failure', metric: 'efficiency', threshold: 5, windowDays: 14, category: 'performance' },
  { name: 'Classification failures', type: 'kpi-failure', metric: 'classification', threshold: 2, windowDays: 28, category: 'performance' },
  { name: 'Repeated QA errors', type: 'qa-errors', threshold: 3, windowDays: 30, category: 'quality' },
];

// Training programmes and a sample knowledge test
export const TRAINING_PROGRAMS = [
  { title: 'Customer Verification Process', category: 'process', durationHours: 2, description: 'Steps to verify a customer before sharing account details.', completionCriteria: 'Watch the module and pass the verification test' },
  { title: 'Ticket Classification Masterclass', category: 'process', durationHours: 3, description: 'How to pick the right category and sub-category for every case.', completionCriteria: 'Complete all 4 lessons' },
  { title: 'Information Security Awareness', category: 'compliance', durationHours: 1, description: 'Annual mandatory security training.', completionCriteria: 'Complete the module' },
];

export const KNOWLEDGE_TEST = {
  title: 'Weekly Process Check - Verification',
  description: 'Five quick questions on the customer verification process.',
  passPercent: 80,
  maxAttempts: 2,
  questions: [
    { text: 'How many security questions must be verified before sharing account details?', options: ['One', 'Two', 'Three', 'None'], correctIndex: 1 },
    { text: 'A caller cannot answer the security questions. What should you do?', options: ['Share partial details', 'Escalate to the manager', 'Politely decline and offer the secure channel', 'Ask a colleague'], correctIndex: 2 },
    { text: 'Which of these is NOT allowed to be read out on a call?', options: ['Ticket number', 'Full card number', 'Registered city', 'Customer first name'], correctIndex: 1 },
    { text: 'When must the verification step be documented?', options: ['Only for complaints', 'Never', 'On every interaction', 'Only for chats'], correctIndex: 2 },
    { text: 'Verification failed 3 times. The account should be:', options: ['Closed', 'Flagged for review', 'Ignored', 'Upgraded'], correctIndex: 1 },
  ],
};
