import clsx from 'clsx';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';

export function Spinner({ className }) {
  return <Loader2 className={clsx('h-6 w-6 animate-spin text-brand-600', className)} />;
}

// Grey shimmering placeholder block
export function Skeleton({ className }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-md bg-slate-200/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

// Generic page placeholder: a header line + a few cards
export function PageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {message}
      </span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 font-medium hover:underline">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
