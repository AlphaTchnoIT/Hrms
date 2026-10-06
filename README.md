# PeopleHub HRMS

A full-stack Human Resource Management System built with **Next.js 15**, **Node.js / Express 5** and **MongoDB**, set up for **UK companies**: UK time (Europe/London), GBP, bank holidays and PAYE payroll. Timezone and currency can be changed in Settings.
Attendance is captured through **web check-in / check-out** (with optional browser location), so no biometric hardware is needed.

## Features

| Module | What it does |
| --- | --- |
| **Auth & roles** | JWT login. Six roles: `admin`, `hr`, `manager`, `employee`, `qa` (quality auditor), `it` (IT support) |
| **Dashboard** | Live check-in card, team stats, 7-day attendance chart, department headcount, pending approvals, holidays, birthdays & work anniversaries, who's on leave |
| **Employees** | Create / edit / deactivate, auto employee codes (EMP0001), job, personal, bank and salary details, password reset, CSV export |
| **Directory** | Searchable company directory for everyone |
| **Organization** | Departments (with heads) and designations |
| **Attendance** | Web check-in/out with IP + location, late marking with grace period, auto present / half-day / absent, monthly calendar, regularization requests & approval |
| **Team attendance** | Daily "who's in" view and monthly report with CSV export |
| **Leave** | Leave types & yearly quotas, balances, half-day leave, holidays/weekly-offs excluded, approval workflow, cancel, HR balance adjustment |
| **Holidays** | Yearly holiday calendar |
| **Payroll (UK PAYE)** | Monthly run: Income Tax from the tax code (incl. Scottish `S` codes, `BR`, `D0`, `D1`, `0T`, `NT`, `K` codes), Class 1 National Insurance by category, workplace pension (auto-enrolment, qualifying earnings), student and postgraduate loans, employer NI + pension costs; unpaid days, re-run, mark paid (locks), bank-sheet CSV with sort codes, printable payslips |
| **Expenses** | Claims with receipt link → manager approval → HR reimbursement |
| **Performance** | Goals with progress, weightage, self rating and manager review |
| **Assets** | Company equipment inventory, assign / return |
| **Announcements** | Pinned, categorised, with expiry |
| **Notifications** | In-app bell for approvals, payslips, assignments |
| **Settings** | Company timezone and currency, office timings, grace time, full/half-day thresholds, weekly offs, location requirement, unpaid-absence rule, UK payroll rates (tax bands, NI, pension, student loans) |
| **Roster & shifts** | Managers publish shifts (morning / general / evening / night) and weekly offs; employees see the next two weeks with scheduled hours |
| **Attendance tracking** | Day status: Present, Late Login, Short Login, Absent, Sick Leave, Emergency Leave (Time Off for Dependants), Approved Leave, Weekly Off, Holiday — measured against the roster |
| **Login / AT hours** | Login, productive (AT) and idle hours per day; short-login, late-login and idle-time flags; CSV export |
| **KPI dashboard** | Quality (QA), efficiency (with new-joiner glide path), classification and shift adherence; current vs previous 30 days, 13-week trend, 3-month adherence trend |
| **Performance status** | Meeting Target / Needs Attention / Critical from configurable targets and band |
| **3-parameter rating** | Weighted quality / efficiency / classification → 1–5 rating; monthly ratings need **mutual approval by QA and HR** (dispute + resubmit flow) |
| **Manager rating** | Each manager is rated from their team's KPI achievement |
| **Action plans** | Generated from failing KPIs or created by managers: actions, target, deadline, follow-ups, employee acknowledgement, and **forward performance** (weekly score vs baseline/target, on-track / off-track) |
| **Quality** | QA audits with error categories and fatal errors (weekly QA score auto-calculated), employee acknowledgement, repeated-error tracking |
| **Calibration** | Random resolved interaction (daily/weekly); manager and QA audit blind; variance & accuracy; both teams sign off an agreed score |
| **Employee relations** | Escalations with evidence and audit trail; warnings by **category** and **stage 1–4** (verbal → first written → final → termination review) with electronic acknowledgement; configurable warning triggers; full history per employee |
| **Manager workspace** | My Team Home (only assigned reports), team performance dashboard, Attention Required list |
| **Reports & analytics** | Reports Centre (12 reports, CSV export) and Management Dashboard (attrition, attendance, KPI achievement, QA, teams requiring attention) |
| **Recruitment (ATS)** | Internal job posting with eligibility, external candidates, pipeline statuses, interview scheduling with panel feedback, document collection, public status page, email + in-app notifications |
| **Learning** | Training programmes & assignments, in-app knowledge tests (auto-graded, attempts, time limit, answer key, report cards), automatic hourly reminders, training records |
| **UK HR** | Right to work checks (follow-up reminders 60 / 30 days before time-limited permission expires), probation reminders, bank holidays per nation with **Sync from GOV.UK** (auto-loads next year), holiday pro-rata for part-time staff and joiners, carry-over, notice periods vs the statutory minimum, 48-hour week opt-out, fit note flag for 7+ day sickness, HMRC mileage claims (45p / 25p) |
| **UK pay rules** | Statutory Sick / Maternity / Paternity Pay through payroll, workplace pension auto-enrolment status (eligible / non-eligible / entitled, opt-out date), National Minimum Wage check on contracted hours, payroll warnings before paying |
| **Admin-controlled UK policies** | Settings -> UK employment policies: leave year (e.g. April - March), request windows, fit note rule, reminder timings, Bradford Factor levels, enhanced maternity pay; company registrations (PAYE, Accounts Office, Companies House, ICO, pension). Statutory figures (rates, weeks, %) in Settings -> UK payroll rates |
| **Compliance checklist** | 20 built-in UK items (contracts, ACAS-based policies, right to work, insurance, PAYE / RTI, pension, ICO, DPA, international transfers, privacy notice, DPIA, retention, gender pay gap, modern slavery) with status, reviewer (lawyer / accountant), review dates, documents and reminders; add your own items |
| **UK reports** | Bradford Factor (sickness), gender pay gap (mean, median, quartiles), UK compliance (right to work, minimum wage, pension, probation, notice) |
| **Accounts & security** | One-time passwords for new accounts with a forced change at first login, forgot / reset password by email, sessions ended when a password changes, login and reset rate limits |
| **UK GDPR** | "Download my data" for everyone, full data export per employee for HR (subject access requests), anonymising leavers after the retention period, privacy notice link, switch off Payroll or Live Work Status per company |
| **IT helpdesk** | Tickets with categories/priority, conversation, internal notes, assignment, resolve / reopen |
| **Grievances & ideas** | Confidential (optionally anonymous) grievances visible only to HR; feedback & suggestions with management response |
| **Leave summary** | Leave taken per type summed per quarter |

## Project structure

```
HRMS/
├── backend/                  Express REST API
│   └── src/
│       ├── config/           env + MongoDB connection
│       ├── constants/        roles, enums
│       ├── models/           Mongoose schemas (one file per entity)
│       ├── controllers/      request handlers (one file per module)
│       ├── services/         business logic (attendance, leave, payroll, access, calendar…)
│       ├── routes/           Express routers (one file per module)
│       ├── middlewares/      auth (protect / authorize) and error handler
│       ├── utils/            ApiError, response helper, date helpers, pagination
│       ├── seed/             demo data + seed script
│       ├── app.js            Express app
│       └── server.js         entry point
└── frontend/                 Next.js (App Router) + Tailwind CSS
    └── src/
        ├── app/
        │   ├── login/        public login page
        │   └── (app)/        all protected pages (dashboard, attendance, leave, team/*, payroll …)
        ├── components/
        │   ├── ui/           Button, Input, Modal, DataTable, Badge, Card … (reusable)
        │   ├── layout/       AppShell, Sidebar, Topbar, NotificationBell, RoleGuard
        │   ├── shared/       EmployeeCell, MonthYearPicker, ReviewModal …
        │   └── attendance/ leave/ employees/ payroll/ performance/ dashboard/
        ├── context/          AuthContext
        ├── hooks/            useFetch, useForm
        └── lib/              api client, constants, navigation, formatters, csv
```

## Getting started

**Requirements:** Node.js 18+ and MongoDB running locally (or a MongoDB Atlas URI).

```bash
# 1. Install everything
npm install
npm run install:all

# 2. Configure (defaults already work for local MongoDB)
#    backend/.env        -> MONGO_URI, JWT_SECRET, CLIENT_URL
#    frontend/.env.local -> NEXT_PUBLIC_API_URL

# 3. Load demo data (clears the database!)
npm run seed

# 4. Run API (port 5000) + web app (port 3000) together
npm run dev
```

Open http://localhost:3000

### Demo accounts (password `Password@123`)

| Role | Email |
| --- | --- |
| Admin | admin@hrms.com |
| HR | hr@hrms.com |
| Manager | manager@hrms.com |
| Employee | employee@hrms.com |
| Team lead (employee role) | thomas@hrms.com |
| QA auditor | qa@hrms.com |
| IT support | it@hrms.com |

### Setting up a real company (no demo data)

```bash
# Empty database only. Creates UK settings, leave types, bank holidays and the first admin
npm run setup -- --company "Acme Ltd" --email jane@acme.co.uk --first Jane --last Smith
```

The admin's one-time password is printed once and must be changed at first login.

### Going live for a UK client (checklist)

1. **Hosting in the UK / EU**: MongoDB Atlas cluster in London (`eu-west-2`) or another EU region; API and web app in an EU region. One deployment + database per client.
2. **Backend env**: strong `JWT_SECRET`, `CLIENT_URL` = the client's web address, `SMTP_*` set (password reset emails need it), `NODE_ENV=production`.
3. **Frontend env**: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DEMO_MODE=false`.
4. Run `npm run setup` (never `npm run seed` – it wipes the database).
5. In **Settings**: company details, office hours, UK payroll rates for the current tax year, modules (switch off Payroll if payroll is run elsewhere), privacy notice link, retention years.
6. **UK GDPR paperwork** (client + you): data processing agreement, staff privacy notice, and a DPIA before switching on Live Work Status. Turn on database backups.
7. **Payroll**: payslips and figures come from this app, but RTI submissions (FPS / EPS) to HMRC must be made from HMRC-recognised payroll software. SSP / SMP and P45 / P60 are not produced.
8. Run `npm test` (payroll and leave rules) after changing rates or rules.
9. Work through **Administration -> Compliance checklist** with the client's employment lawyer and accountant, and set **Settings -> UK employment policies** to match their contracts and handbook.

## Validation

Every form is validated twice with the same rules:

- **Frontend** – `frontend/src/lib/validation.js` (zod) + `useForm` hook. Errors appear under the field when it is left or on submit, and focus jumps to the first invalid field.
- **Backend** – `backend/src/validators/*.validator.js` (zod) applied by the `validate()` middleware on each route. Invalid requests get `422 { message, errors: { field: message } }`, and the form shows those messages on the matching fields. Business rules (overlapping leave, insufficient balance, duplicate email, etc.) are returned the same way.

Examples: UK phone (`07700 900123` or `+44 …`), National Insurance number `QQ 12 34 56 C`, sort code `12-34-56`, 8-digit account number, UK postcode `EC2A 4NE`, HMRC tax code `1257L`, age 18–80, password ≥ 8 chars with a letter and a number, no future expense dates, regularization only for the last 30 days, a reason is mandatory when rejecting.

## Business rules (quick reference)

- **Late**: check-in after `officeStartTime + graceMinutes`.
- **Day status** on check-out: worked ≥ `fullDayMinutes` → present, ≥ `halfDayMinutes` → half-day, else absent.
- **Leave days** count only working days (weekly offs and non-optional holidays are skipped). Paid leave needs balance; unpaid leave does not.
- **Payroll** is prorated on working days: `pay = (annual salary / 12 + monthly allowance) × paid working days / working days`.
  Unpaid days = unauthorised absence (if enabled) + ½ × half-days + unpaid / statutory-pay leave + working days before joining / after exit. Working days come from the roster, else the company weekly offs (scaled by days per week for part-timers, who are never marked absent without a roster). Bank holidays are paid.
- **Statutory pay** (leave types with SSP / SMP / SPP): SSP = lower of the weekly rate or 80% of average weekly earnings per working day (from day one, April 2026 rules); SMP = 90% for 6 weeks then the lower of the flat rate or 90% up to week 39; SPP = flat rate for up to 2 weeks. Taxable and NI-able.
- **UK deductions** (month 1 / non-cumulative basis): pension = employee % of qualifying earnings (net pay arrangement, before tax); Income Tax = annual bands on (taxable pay × 12 − allowance from the tax code) ÷ 12; employee NI on pay between the primary threshold and upper earnings limit (category C / X: none); student loans 9% / postgraduate 6% above the plan threshold, rounded down to whole pounds. Rates live in Settings → UK payroll rates and should be checked every April. Payroll does not file to HMRC: submit RTI (FPS) from HMRC-recognised software.
- Employees see payslips only after HR marks the payroll run as **paid**.
- **Performance status** (last 30 days): score ≥ target → Meeting Target; within `attentionBand` points below → Needs Attention; lower → Critical. The worst KPI decides the overall status.
- **Efficiency target** follows the glide path for new joiners (e.g. week 1–4: 60%, 5–8: 70%, 9–12: 80%, then the normal target).
- **Adherence** = rostered working days logged in on time and for at least `shortLoginPercent` of the shift ÷ rostered working days.
- **Rating**: weighted achievement (score ÷ target) of quality, efficiency, classification → ≥105% = 5, ≥100% = 4, ≥95% = 3, ≥85% = 2, else 1. Manager rating uses the team's average achievement.
- **Warning stage**: next stage = highest active (not expired / withdrawn) stage in the same category + 1. Managers cannot skip stages; only HR can.
- **Email**: set `SMTP_*` in `backend/.env` to also send emails (interview invites, document requests, status changes, warnings). Without it, in-app notifications only.

## API overview

All routes are under `/api` and (except login) need `Authorization: Bearer <token>`.

```
POST   /auth/login                 GET/PATCH /auth/me           PATCH /auth/change-password
GET    /dashboard
GET    /employees  (HR)            POST /employees              GET/PUT/DELETE /employees/:id
GET    /employees/directory        GET  /employees/team
GET    /departments | /designations (+ POST/PUT/DELETE for HR)
GET    /attendance/today           POST /attendance/check-in    POST /attendance/check-out
GET    /attendance/my              GET  /attendance/daily       GET  /attendance/report
GET    /attendance/employee/:id    /attendance/regularizations (POST, GET, /my, /:id/review, /:id/cancel)
GET    /leaves/types | /leaves/balances | /leaves/my | /leaves/who-is-out
POST   /leaves                     PATCH /leaves/:id/review     PATCH /leaves/:id/cancel
GET    /payroll/runs               POST /payroll/runs           PATCH /payroll/runs/:id/mark-paid
GET    /payroll/my-payslips        GET  /payroll/payslips/:id
/expenses  /goals  /assets  /holidays  /announcements  /notifications  /settings
/workforce   (roster, attendance status, login-hours, trends)
/performance (my, team, employee/:id, kpis, ratings, manager-ratings)   /action-plans
/quality     (feedback, repeated-errors, interactions, calibrations)    /relations (escalations, warnings, triggers, flags, history)
/workspace/team   /reports   /reports/:type   /reports/management   /leaves/quarterly-summary
/recruitment (HR ATS)   /careers (internal jobs, my applications, interview panels)   /public/application-status (no login)
/learning    (programs, assignments, tests, attempts, records, reminders)   /support (tickets, grievances, suggestions)
```
