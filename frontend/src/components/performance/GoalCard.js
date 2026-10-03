import { CalendarDays, Star } from 'lucide-react';
import { formatDate, getFullName } from '@/lib/format';
import { Avatar, Badge } from '@/components/ui';

function Stars({ value }) {
  if (!value) return <span className="text-xs text-slate-400">Not rated</span>;
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-3.5 w-3.5 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

export default function GoalCard({ goal, showOwner = false, onEdit, onDelete }) {
  return (
    <div className="card flex flex-col p-4">
      {showOwner && goal.user && (
        <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Avatar name={getFullName(goal.user)} size="sm" />
          <span className="text-sm font-medium text-slate-700">{getFullName(goal.user)}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{goal.title}</h3>
        <Badge status={goal.status} />
      </div>
      {goal.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{goal.description}</p>}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span className="font-medium text-slate-700">{goal.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${goal.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {goal.dueDate && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(goal.dueDate)}
          </span>
        )}
        {goal.weightage > 0 && <span>Weightage {goal.weightage}%</span>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs">
        <div>
          <p className="text-slate-500">Self</p>
          <Stars value={goal.selfRating} />
        </div>
        <div>
          <p className="text-slate-500">Manager</p>
          <Stars value={goal.managerRating} />
        </div>
        {goal.managerComment && <p className="col-span-2 italic text-slate-600">“{goal.managerComment}”</p>}
      </div>

      <div className="mt-auto flex justify-end gap-2 pt-4">
        {onDelete && (
          <button onClick={() => onDelete(goal)} className="text-xs font-medium text-red-600 hover:underline">
            Delete
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(goal)} className="text-xs font-medium text-brand-600 hover:underline">
            Update
          </button>
        )}
      </div>
    </div>
  );
}
