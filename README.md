# PeopleHub HRMS

A full-stack Human Resource Management System (Keka-style) built with **Next.js 15**, **Node.js / Express 5** and **MongoDB**.
Attendance is captured through **web check-in / check-out** (with optional browser location), so no biometric hardware is needed.

## Features

| Module | What it does |
| --- | --- |
| **Auth & roles** | JWT login. Four roles: `admin`, `hr`, `manager`, `employee` |
| **Dashboard** | Live check-in card, team stats, 7-day attendance chart, department headcount, pending approvals, holidays, birthdays & work anniversaries, who's on leave |
| **Employees** | Create / edit / deactivate, auto employee codes (EMP0001), job, personal, bank and salary details, password reset, CSV export |
| **Directory** | Searchable company directory for everyone |
| **Organization** | Departments (with heads) and designations |
| **Attendance** | Web check-in/out with IP + location, late marking with grace period, auto present / half-day / absent, monthly calendar, regularization requests & approval |
| **Team attendance** | Daily "who's in" view and monthly report with CSV export |
| **Leave** | Leave types & yearly quotas, balances, half-day leave, holidays/weekly-offs excluded, approval workflow, cancel, HR balance adjustment |
| **Holidays** | Yearly holiday calendar |
| **Payroll** | Monthly payroll run with LOP (attendance + unpaid leave), PF (with cap), professional tax, TDS; re-run, mark paid (locks), bank-sheet CSV, printable payslips |
| **Expenses** | Claims with receipt link → manager approval → HR reimbursement |
| **Performance** | Goals with progress, weightage, self rating and manager review |
| **Assets** | Company equipment inventory, assign / return |
| **Announcements** | Pinned, categorised, with expiry |
| **Notifications** | In-app bell for approvals, payslips, assignments |
| **Settings** | Office timings, grace time, full/half-day thresholds, weekly offs, location requirement, PF/PT, LOP rule |

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

## Validation

Every form is validated twice with the same rules:

- **Frontend** – `frontend/src/lib/validation.js` (zod) + `useForm` hook. Errors appear under the field when it is left or on submit, and focus jumps to the first invalid field.
- **Backend** – `backend/src/validators/*.validator.js` (zod) applied by the `validate()` middleware on each route. Invalid requests get `422 { message, errors: { field: message } }`, and the form shows those messages on the matching fields. Business rules (overlapping leave, insufficient balance, duplicate email, etc.) are returned the same way.

Examples: Indian mobile (10 digits), PAN `ABCDE1234F`, IFSC `HDFC0001234`, 6-digit pincode, age 18–80, password ≥ 8 chars with a letter and a number, no future expense dates, regularization only for the last 30 days, a reason is mandatory when rejecting.

## Business rules (quick reference)

- **Late**: check-in after `officeStartTime + graceMinutes`.
- **Day status** on check-out: worked ≥ `fullDayMinutes` → present, ≥ `halfDayMinutes` → half-day, else absent.
- **Leave days** count only working days (weekly offs and non-optional holidays are skipped). Paid leave needs balance; unpaid (LOP) does not.
- **Payroll** is prorated by calendar days: `pay = monthly × paidDays / totalDays`.
  LOP days = absent days + ½ × half-days + unpaid leave + days before joining / after exit.
- Employees see payslips only after HR marks the payroll run as **paid**.

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
```
