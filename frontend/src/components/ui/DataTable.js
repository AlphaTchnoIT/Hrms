import clsx from 'clsx';
import { Skeleton } from './Feedback';
import EmptyState from './EmptyState';

/*
 * Simple table.
 *   columns = [{ key: 'name', header: 'Name', render: (row) => ..., className, align: 'right' }]
 *   rows    = array of objects (must have _id, or pass rowKey)
 */
export default function DataTable({
  columns,
  rows,
  loading,
  emptyMessage = 'No records found',
  emptyTitle,
  emptyIcon,
  emptyAction,
  rowKey = '_id',
  onRowClick,
}) {
  const showSkeleton = loading && !rows?.length;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:pl-5 last:pr-5',
                  col.align === 'right' && 'text-right',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={clsx('divide-y divide-slate-100', loading && rows?.length && 'opacity-60 transition-opacity')}>
          {showSkeleton &&
            [1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-4 first:pl-5 last:pr-5">
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && !rows?.length && (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={emptyTitle} message={emptyMessage} icon={emptyIcon} action={emptyAction} />
              </td>
            </tr>
          )}

          {!showSkeleton &&
            rows?.map((row, index) => (
              <tr
                key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey] || index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx('transition-colors', onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : 'hover:bg-slate-50/70')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'whitespace-nowrap px-4 py-3 text-slate-700 first:pl-5 last:pr-5',
                      col.align === 'right' && 'text-right',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
