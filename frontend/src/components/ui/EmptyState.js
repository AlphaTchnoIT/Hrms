import { Inbox } from 'lucide-react';

export default function EmptyState({ title, message = 'Nothing here yet', icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      {title && <p className="font-medium text-slate-800">{title}</p>}
      <p className="mt-0.5 max-w-sm text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
