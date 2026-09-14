'use client';
import { cn } from './cn';
import { EmptyState, Skeleton } from './feedback';

export type Column<Row> = {
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /** Shown as the card title on phones. Exactly one column should set it. */
  primary?: boolean;
  /** Dropped from the phone card layout to keep cards short. */
  hideOnMobile?: boolean;
  align?: 'start' | 'end';
  className?: string;
};

/**
 * Dense table from `md` up; stacked cards below, so nothing scrolls sideways at
 * 390px. Row actions go in a column; they are always visible (touch has no hover).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
  caption,
  className,
}: {
  columns: Column<Row>[];
  rows: Row[] | undefined;
  rowKey: (row: Row, index: number) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  caption?: string;
  className?: string;
}) {
  if (loading)
    return (
      <div className={cn('grid gap-2 p-4', className)} role="status" aria-label={caption}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
    );
  if (!rows?.length) return <div className={cn('p-4', className)}>{empty ?? <EmptyState title="—" compact />}</div>;
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && !column.hideOnMobile);
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-[#fafbfd]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-xs font-bold text-muted',
                    column.align === 'end' ? 'text-end' : 'text-start',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('transition-colors hover:bg-[#fafbff]', onRowClick && 'cursor-pointer')}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-3 align-middle', column.align === 'end' ? 'text-end' : 'text-start', column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid divide-y divide-line md:hidden">
        {rows.map((row, index) => (
          <li
            key={rowKey(row, index)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('grid gap-2 px-4 py-3.5', onRowClick && 'cursor-pointer active:bg-canvas')}
          >
            {primary && <div className="min-w-0 font-bold text-ink">{primary.cell(row)}</div>}
            {secondary.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {secondary.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-xs text-muted">{column.header}</dt>
                    <dd className="mt-0.5 min-w-0 break-words">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
