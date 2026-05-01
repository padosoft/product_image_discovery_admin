import React from 'react';

export function Toast({ open, tone = 'neutral', children }) {
  if (!open) {
    return null;
  }

  return <div className={`pid-toast pid-toast--${tone}`}>{children}</div>;
}
