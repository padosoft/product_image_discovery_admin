import React from 'react';

export function FilterBar({ label = 'Filters', filters = [], onClear }) {
  return (
    <div className="pid-filter-bar" aria-label={label}>
      <div className="pid-filter-bar__label">{label}</div>
      <div className="pid-filter-bar__chips">
        {filters.length === 0 ? (
          <span className="pid-muted">No active filters</span>
        ) : filters.map((filter) => (
          <span className="pid-filter-chip" key={filter.key}>
            <span>{filter.label}</span>
            <span>{filter.value}</span>
          </span>
        ))}
      </div>
      {onClear ? (
        <button type="button" className="pid-chip-button" onClick={onClear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}
