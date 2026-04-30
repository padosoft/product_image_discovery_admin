import React from 'react';

export function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="pid-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pid-modal__panel">
        <strong>{title}</strong>
        <p>{description}</p>
        <div className="pid-modal__actions">
          <button type="button" className="pid-chip-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="pid-chip-button pid-chip-button--accent" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
