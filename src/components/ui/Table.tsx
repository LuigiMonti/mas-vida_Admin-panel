import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Columnas numéricas: alineadas a la derecha y con cifras tabulares. */
  numeric?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedKey?: string;
  onRowClick?: (row: T) => void;
  /** Lo que se muestra si no hay filas (un <EmptyState>). */
  empty?: ReactNode;
  caption?: string;
}

/** Tabla densa para escritorio. Hace scroll horizontal en tablet en vez de romperse. */
export function DataTable<T>({ columns, rows, rowKey, selectedKey, onRowClick, empty, caption }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full border-separate border-spacing-0 text-[13.5px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  'border-b border-border px-3 pb-2.5 text-[12px] font-semibold whitespace-nowrap text-text-muted first:pl-0 last:pr-0',
                  c.numeric || c.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r);
            const sel = k === selectedKey;
            return (
              <tr
                key={k}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                aria-selected={onRowClick ? sel : undefined}
                className={cx(
                  'group',
                  onRowClick && 'cursor-pointer',
                  sel ? '[&>td]:bg-primary-tint' : onRowClick && 'hover:[&>td]:bg-surface-muted',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      'border-b border-border px-3 py-2.5 align-middle group-last:border-b-0 first:rounded-l-inner first:pl-3 last:rounded-r-inner',
                      (c.numeric || c.align === 'right') && 'text-right',
                      c.numeric && 'tabular-nums',
                      c.className,
                    )}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
