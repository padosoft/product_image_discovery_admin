import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

export function DataTable({
  ariaLabel,
  columns,
  rows,
  rowKey = 'id',
  loading = false,
  emptyTitle = 'No rows',
  emptyDescription = 'There is nothing to show right now.',
}) {
  if (loading) {
    return <LoadingState label={emptyTitle} />;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="pid-table-wrap">
      <table className="pid-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey];

            return (
              <tr key={key}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render ? column.render(row) : row[column.key] ?? '-'}
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
