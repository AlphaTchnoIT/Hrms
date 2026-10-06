import {
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Contact,
  Crosshair,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  Headphones,
  HeartHandshake,
  House,
  LayoutDashboard,
  Laptop,
  Network,
  ShieldCheck as ShieldCheckIcon,
  Radio,
  Activity,
  LineChart,
  ListChecks,
  Megaphone,
  Receipt,
  ReceiptText,
  Scale,
  Settings,
  ShieldAlert,
  Star,
  Target,
  Timer,
  UserCog,
  UserRound,
  UserSearch,
  Users,
  WalletCards,
} from 'lucide-react';
import { APPROVER_ROLES, AUDITOR_ROLES, HR_ROLES, ROLES } from './constants';
import { CurrencyBadgeIcon } from '@/components/shared/CurrencyIcon';

const REPORT_ROLES = [...APPROVER_ROLES, ROLES.QA, ROLES.IT];

/*
 * Sidebar menu. `roles` = who can see the item (omit for everyone).
 */
export const NAVIGATION = [
  {
    title: null,
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Me',
    items: [
      { label: 'My Profile', href: '/profile', icon: UserRound },
      { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
      { label: 'My Work Status', href: '/my-status', icon: Activity, feature: 'workStatus' },
      { label: 'My Roster', href: '/roster', icon: CalendarRange },
      { label: 'Leave', href: '/leave', icon: CalendarDays },
      { label: 'Payslips', href: '/payslips', icon: WalletCards, feature: 'payroll' },
      { label: 'Expenses', href: '/expenses', icon: Receipt },
      { label: 'Performance', href: '/performance', icon: Gauge },
      { label: 'QA Feedback', href: '/quality', icon: Star },
      { label: 'My Conduct', href: '/my-conduct', icon: ShieldAlert },
      { label: 'Learning', href: '/learning', icon: GraduationCap },
      { label: 'Internal Jobs', href: '/careers', icon: Briefcase },
    ],
  },
  {
    title: 'Manager Workspace',
    roles: APPROVER_ROLES,
    items: [
      { label: 'My Team Home', href: '/team/home', icon: House },
      { label: 'Live Status', href: '/team/live-status', icon: Radio, feature: 'workStatus' },
      { label: 'Team Performance', href: '/team/performance', icon: LineChart },
      { label: 'Action Plans', href: '/team/action-plans', icon: ListChecks },
      { label: 'Team Roster', href: '/team/roster', icon: CalendarClock },
      { label: 'Login / AT Hours', href: '/team/login-hours', icon: Timer },
      { label: 'Team Attendance', href: '/team/attendance', icon: CalendarCheck },
      { label: 'Attendance Report', href: '/team/attendance-report', icon: FileSpreadsheet },
      { label: 'Leave Approvals', href: '/team/leave-approvals', icon: ClipboardCheck },
      { label: 'Regularisations', href: '/team/regularizations', icon: CalendarRange },
      { label: 'Expense Approvals', href: '/team/expense-approvals', icon: ReceiptText },
      { label: 'Team Goals', href: '/team/goals', icon: Target },
      { label: 'Employee Relations', href: '/relations', icon: Scale },
    ],
  },
  {
    title: 'Quality & Learning',
    roles: AUDITOR_ROLES,
    items: [
      { label: 'QA Audits', href: '/qa-audits', icon: ClipboardList },
      { label: 'Calibration', href: '/calibration', icon: Crosshair },
      { label: 'Rating Approvals', href: '/ratings', icon: Star },
      { label: 'Training Admin', href: '/training-admin', icon: BookOpen },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'IT Helpdesk', href: '/helpdesk', icon: Headphones },
      { label: 'Grievances & Ideas', href: '/support', icon: HeartHandshake },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Employees', href: '/employees', icon: Users, roles: HR_ROLES },
      { label: 'Directory', href: '/directory', icon: Contact },
      { label: 'Org Chart', href: '/org-chart', icon: Network },
      { label: 'Organisation', href: '/organization', icon: Building2, roles: HR_ROLES },
      { label: 'Holidays', href: '/holidays', icon: CalendarDays },
      { label: 'Announcements', href: '/announcements', icon: Megaphone },
      { label: 'Assets', href: '/assets', icon: Laptop, roles: HR_ROLES },
    ],
  },
  {
    title: 'Analytics',
    roles: REPORT_ROLES,
    items: [
      { label: 'Management Dashboard', href: '/management', icon: ChartColumn, roles: HR_ROLES },
      { label: 'Reports Centre', href: '/reports', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Administration',
    roles: HR_ROLES,
    items: [
      { label: 'Recruitment (ATS)', href: '/recruitment', icon: UserSearch },
      { label: 'Payroll', href: '/payroll', icon: CurrencyBadgeIcon, feature: 'payroll' },
      { label: 'Leave Policies', href: '/leave-types', icon: UserCog },
      { label: 'Compliance Checklist', href: '/compliance', icon: ShieldCheckIcon },
      { label: 'Settings', href: '/settings', icon: Settings, roles: [ROLES.ADMIN] },
    ],
  },
];

// `roles` = the user's access roles, e.g. ['employee', 'manager'] for a team lead; `features` = modules switched on
export function getNavigationForRole(roles = [], features = {}) {
  const allowed = (list) => !list || roles.some((role) => list.includes(role));
  const enabled = (item) => !item.feature || features[item.feature] !== false;
  return NAVIGATION.filter((section) => allowed(section.roles))
    .map((section) => ({ ...section, items: section.items.filter((item) => allowed(item.roles) && enabled(item)) }))
    .filter((section) => section.items.length);
}

export function isNavItemActive(pathname, href) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

// The menu item (and its section) for the current page, used for the breadcrumb
export function findNavItem(pathname) {
  let match = { section: null, item: null };
  NAVIGATION.forEach((section) =>
    section.items.forEach((item) => {
      if (isNavItemActive(pathname, item.href) && (!match.item || item.href.length > match.item.href.length)) {
        match = { section, item };
      }
    })
  );
  return match;
}
