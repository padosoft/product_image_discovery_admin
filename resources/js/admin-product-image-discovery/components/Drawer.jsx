import React from 'react';

export function Drawer({ open, title, onClose, children }) {
  if (!open) {
    return null;
  }

  return (
    <div className="pid-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pid-drawer__backdrop" onClick={onClose} />
      <div className="pid-drawer__panel">
        <div className="pid-drawer__header">
          <strong>{title}</strong>
          <button type="button" className="pid-chip-button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="pid-drawer__body">{children}</div>
      </div>
    </div>
  );
}
