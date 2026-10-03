import Link from 'next/link';
import { Avatar } from '@/components/ui';
import { getFullName } from '@/lib/format';

// Avatar + name + employee code, used inside tables
export default function EmployeeCell({ employee, subtitle, href }) {
  if (!employee) return <span className="text-slate-400">—</span>;
  const name = getFullName(employee);

  const content = (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={employee.avatar} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{name}</p>
        <p className="truncate text-xs text-slate-500">{subtitle ?? employee.employeeCode}</p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}
