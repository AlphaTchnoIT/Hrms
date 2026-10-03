import {
  BadgeIndianRupee,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Contact,
  FileSpreadsheet,
  LayoutDashboard,
  Laptop,
  Megaphone,
  Receipt,
  ReceiptText,
  Settings,
  Target,
  UserCog,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { APPROVER_ROLES, HR_ROLES, ROLES } from './constants';

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
      { label: 'Leave', href: '/leave', icon: CalendarDays },
      { label: 'Payslips', href: '/payslips', icon: WalletCards },
      { label: 'Expenses', href: '/expenses', icon: Receipt },
      { label: 'Performance', href: '/performance', icon: Target },
    ],
  },
  {
    title: 'Team',
    roles: APPROVER_ROLES,
    items: [
      { label: 'Team Attendance', href: '/team/attendance', icon: CalendarClock },
      { label: 'Attendance Report', href: '/team/attendance-report', icon: FileSpreadsheet },
      { label: 'Leave Approvals', href: '/team/leave-approvals', icon: ClipboardCheck },
      { label: 'Regularizations', href: '/team/regularizations', icon: CalendarRange },
      { label: 'Expense Approvals', href: '/team/expense-approvals', icon: ReceiptText },
      { label: 'Team Goals', href: '/team/goals', icon: Target },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Employees', href: '/employees', icon: Users, roles: HR_ROLES },
      { label: 'Directory', href: '/directory', icon: Contact },
      { label: 'Organization', href: '/organization', icon: Building2, roles: HR_ROLES },
      { label: 'Holidays', href: '/holidays', icon: CalendarDays },
      { label: 'Announcements', href: '/announcements', icon: Megaphone },
      { label: 'Assets', href: '/assets', icon: Laptop, roles: HR_ROLES },
    ],
  },
  {
    title: 'Administration',
    roles: HR_ROLES,
    items: [
      { label: 'Payroll', href: '/payroll', icon: BadgeIndianRupee },
      { label: 'Leave Policies', href: '/leave-types', icon: UserCog },
      { label: 'Settings', href: '/settings', icon: Settings, roles: [ROLES.ADMIN] },
    ],
  },
];

export function getNavigationForRole(role) {
  return NAVIGATION.filter((section) => !section.roles || section.roles.includes(role))
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || item.roles.includes(role)) }))
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
