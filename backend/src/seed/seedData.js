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

export const LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', annualQuota: 12, isPaid: true, color: '#6366f1', description: 'For personal work' },
  { name: 'Sick Leave', code: 'SL', annualQuota: 8, isPaid: true, color: '#ef4444', description: 'When you are unwell' },
  { name: 'Earned Leave', code: 'EL', annualQuota: 15, isPaid: true, color: '#10b981', description: 'Planned vacations' },
  { name: 'Emergency Leave', code: 'EML', annualQuota: 3, isPaid: true, color: '#f97316', description: 'Unplanned personal or family emergency' },
  { name: 'Loss of Pay', code: 'LOP', annualQuota: 0, isPaid: false, color: '#64748b', description: 'Unpaid leave' },
];

export const HOLIDAYS = [
  { name: "New Year's Day", date: '2026-01-01', type: 'optional' },
  { name: 'Republic Day', date: '2026-01-26', type: 'national' },
  { name: 'Holi', date: '2026-03-04', type: 'festival' },
  { name: 'Eid ul-Fitr', date: '2026-03-20', type: 'festival' },
  { name: 'Good Friday', date: '2026-04-03', type: 'festival' },
  { name: 'Independence Day', date: '2026-08-15', type: 'national' },
  { name: 'Raksha Bandhan', date: '2026-08-28', type: 'festival' },
  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'national' },
  { name: 'Dussehra', date: '2026-10-20', type: 'festival' },
  { name: 'Diwali', date: '2026-11-09', type: 'festival' },
  { name: 'Christmas', date: '2026-12-25', type: 'national' },
  { name: 'Company Foundation Day', date: '2026-12-31', type: 'company' },
];

export const DEFAULT_PASSWORD = 'Password@123';

/*
 * People. "dept" and "desig" are matched by name, "manager" by email.
 * Salary values are monthly.
 */
export const EMPLOYEES = [
  {
    firstName: 'Aarav', lastName: 'Sharma', email: 'admin@hrms.com', role: 'admin', gender: 'male',
    dept: 'Operations', desig: 'Chief Executive Officer', dateOfJoining: '2020-04-01', dateOfBirth: '1985-06-15',
    salary: { basic: 150000, hra: 60000, conveyance: 5000, specialAllowance: 50000, monthlyTds: 45000 },
  },
  {
    firstName: 'Priya', lastName: 'Verma', email: 'hr@hrms.com', role: 'hr', gender: 'female',
    dept: 'Human Resources', desig: 'HR Manager', manager: 'admin@hrms.com', dateOfJoining: '2021-01-11', dateOfBirth: '1990-10-12',
    salary: { basic: 60000, hra: 24000, conveyance: 3000, specialAllowance: 18000, monthlyTds: 9000 },
  },
  {
    firstName: 'Rohan', lastName: 'Mehta', email: 'manager@hrms.com', role: 'manager', gender: 'male',
    dept: 'Engineering', desig: 'Engineering Manager', manager: 'admin@hrms.com', dateOfJoining: '2021-06-01', dateOfBirth: '1988-02-20',
    salary: { basic: 90000, hra: 36000, conveyance: 3000, specialAllowance: 30000, monthlyTds: 18000 },
  },
  {
    firstName: 'Ananya', lastName: 'Iyer', email: 'employee@hrms.com', role: 'employee', gender: 'female',
    dept: 'Engineering', desig: 'Senior Software Engineer', manager: 'manager@hrms.com', dateOfJoining: '2022-03-14', dateOfBirth: '1994-10-08',
    salary: { basic: 55000, hra: 22000, conveyance: 2000, specialAllowance: 16000, monthlyTds: 6000 },
  },
  {
    firstName: 'Vikram', lastName: 'Singh', email: 'vikram@hrms.com', role: 'employee', gender: 'male',
    dept: 'Engineering', desig: 'Software Engineer', manager: 'manager@hrms.com', dateOfJoining: '2023-07-03', dateOfBirth: '1997-12-01',
    salary: { basic: 40000, hra: 16000, conveyance: 2000, specialAllowance: 10000, monthlyTds: 2500 },
  },
  {
    firstName: 'Sneha', lastName: 'Kapoor', email: 'sneha@hrms.com', role: 'employee', gender: 'female',
    dept: 'Engineering', desig: 'Software Engineer', manager: 'manager@hrms.com', dateOfJoining: '2024-01-15', dateOfBirth: '1998-10-25',
    salary: { basic: 38000, hra: 15200, conveyance: 2000, specialAllowance: 9000, monthlyTds: 2000 },
  },
  {
    firstName: 'Karan', lastName: 'Patel', email: 'karan@hrms.com', role: 'employee', gender: 'male',
    dept: 'Engineering', desig: 'Intern', manager: 'manager@hrms.com', employmentType: 'intern', dateOfJoining: '2026-09-07', dateOfBirth: '2002-05-17',
    salary: { basic: 15000, hra: 0, conveyance: 0, specialAllowance: 5000, pfApplicable: false },
  },
  {
    firstName: 'Neha', lastName: 'Gupta', email: 'neha@hrms.com', role: 'employee', gender: 'female',
    dept: 'Human Resources', desig: 'HR Executive', manager: 'hr@hrms.com', dateOfJoining: '2023-02-01', dateOfBirth: '1996-08-30',
    salary: { basic: 30000, hra: 12000, conveyance: 2000, specialAllowance: 6000 },
  },
  {
    firstName: 'Arjun', lastName: 'Reddy', email: 'arjun@hrms.com', role: 'employee', gender: 'male',
    dept: 'Sales', desig: 'Sales Executive', manager: 'admin@hrms.com', dateOfJoining: '2022-09-19', dateOfBirth: '1993-11-11',
    salary: { basic: 35000, hra: 14000, conveyance: 3000, specialAllowance: 8000, monthlyTds: 1500 },
  },
  {
    firstName: 'Isha', lastName: 'Nair', email: 'isha@hrms.com', role: 'employee', gender: 'female',
    dept: 'Marketing', desig: 'Marketing Executive', manager: 'admin@hrms.com', dateOfJoining: '2023-11-06', dateOfBirth: '1995-04-04',
    salary: { basic: 32000, hra: 12800, conveyance: 2000, specialAllowance: 7000 },
  },
  {
    firstName: 'Rahul', lastName: 'Joshi', email: 'rahul@hrms.com', role: 'employee', gender: 'male',
    dept: 'Finance', desig: 'Accountant', manager: 'admin@hrms.com', dateOfJoining: '2021-10-04', dateOfBirth: '1991-10-05',
    salary: { basic: 36000, hra: 14400, conveyance: 2000, specialAllowance: 8000, monthlyTds: 1800 },
  },
  {
    firstName: 'Meera', lastName: 'Nambiar', email: 'qa@hrms.com', role: 'qa', gender: 'female',
    dept: 'Quality', desig: 'QA Auditor', manager: 'hr@hrms.com', dateOfJoining: '2022-05-02', dateOfBirth: '1992-07-21',
    salary: { basic: 34000, hra: 13600, conveyance: 2000, specialAllowance: 7000, monthlyTds: 1200 },
  },
  {
    firstName: 'Dev', lastName: 'Malhotra', email: 'it@hrms.com', role: 'it', gender: 'male',
    dept: 'IT Support', desig: 'IT Support Engineer', manager: 'admin@hrms.com', dateOfJoining: '2023-04-10', dateOfBirth: '1994-01-30',
    salary: { basic: 33000, hra: 13200, conveyance: 2000, specialAllowance: 6500, monthlyTds: 1000 },
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
    title: 'Diwali Celebration on 6th November',
    content: 'Join us for the Diwali celebration in the cafeteria at 4 PM. Traditional dress encouraged!',
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
