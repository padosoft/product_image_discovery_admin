import React from 'react';

export function EmptyState({ title, description }) {
  return (
    <div className="pid-empty-state" role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
