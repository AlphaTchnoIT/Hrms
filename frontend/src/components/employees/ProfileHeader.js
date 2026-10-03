import { Mail, MapPin, Phone } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
import { getFullName } from '@/lib/format';

export default function ProfileHeader({ employee, actions }) {
  const name = getFullName(employee);
  return (
    <div className="card overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-brand-600 to-violet-500" />
      <div className="flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
          <Avatar name={name} src={employee.avatar} size="xl" className="ring-4 ring-white" />
          <div className="pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">{name}</h1>
              <Badge status={employee.status} />
            </div>
            <p className="text-sm text-slate-500">
              {employee.designation?.title || 'No designation'} · {employee.department?.name || 'No department'} ·{' '}
              {employee.employeeCode}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {employee.email}
              </span>
              {employee.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {employee.phone}
                </span>
              )}
              {employee.workLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {employee.workLocation}
                </span>
              )}
            </div>
          </div>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
