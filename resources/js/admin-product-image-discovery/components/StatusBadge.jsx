import React from 'react';
import { statusTone } from '../status';

export function StatusBadge({ status }) {
  const value = status || 'unknown';

  return (
    <span className={`pid-badge pid-badge--${statusTone(value)}`}>
      {String(value).replaceAll('_', ' ')}
    </span>
  );
}
