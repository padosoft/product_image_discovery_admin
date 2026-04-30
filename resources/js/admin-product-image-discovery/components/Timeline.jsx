import React from 'react';

export function Timeline({ items = [] }) {
  return (
    <ol className="pid-timeline">
      {items.length === 0 ? (
        <li className="pid-muted">No events recorded.</li>
      ) : items.map((item) => (
        <li key={item.id} className="pid-timeline__item">
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </li>
      ))}
    </ol>
  );
}
