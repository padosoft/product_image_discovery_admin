import React from 'react';

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="pid-loading-state" role="status" aria-live="polite">
      <span className="pid-loading-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
