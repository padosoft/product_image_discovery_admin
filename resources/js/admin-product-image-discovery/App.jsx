import React, { useEffect, useMemo, useState } from 'react';
import { pidFetch, normalizeLaravelPagination, buildRequestSearchPath } from './api';
import { DataTable } from './components/DataTable';
import { ConfirmModal } from './components/ConfirmModal';
import { Drawer } from './components/Drawer';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { ImageTile } from './components/ImageTile';
import { JsonViewer } from './components/JsonViewer';
import { ScorePill } from './components/ScorePill';
import { StatusBadge } from './components/StatusBadge';
import { Toast } from './components/Toast';
import { Timeline } from './components/Timeline';
import {
  createDefaultRequestFilters,
  requestFiltersFromSearchParams,
  requestFiltersToActiveChips,
  requestFiltersToSearchParams,
} from './request-filters';

const DEFAULT_SUMMARY = {
  counts: {},
  provider_status: [],
};

const navGroups = [
  {
    label: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', meta: 'Queue totals, provider readiness, recent activity', icon: 'overview' },
      { id: 'requests', label: 'Requests', meta: 'Latest discovery runs and scoring decisions', icon: 'requests' },
      { id: 'review', label: 'Manual Review', meta: 'Items still waiting for operator verification', icon: 'review' },
    ],
  },
  {
    label: 'Diagnostics',
    items: [
      { id: 'debug', label: 'Debug Flow', meta: 'Trace request execution step by step', icon: 'debug' },
      { id: 'reports', label: 'Debug Reports', meta: 'Inspect stored evidence and provider output', icon: 'reports' },
      { id: 'apitest', label: 'API Test', meta: 'Exercise wrapper endpoints from the admin shell', icon: 'api' },
      { id: 'health', label: 'Health', meta: 'Check wrapper availability and local package wiring', icon: 'health' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'settings', label: 'Settings', meta: 'Tune admin defaults and request thresholds', icon: 'settings' },
      { id: 'providers', label: 'Providers', meta: 'Track configured backends and key presence', icon: 'providers' },
      { id: 'trusted', label: 'Trusted Sources', meta: 'Approve supplier and host allowlists', icon: 'trusted' },
    ],
  },
];

const pageIndex = Object.fromEntries(
  navGroups.flatMap((group) => group.items.map((item) => [item.id, item])),
);

function ShellIcon({ name }) {
  const sharedProps = {
    'aria-hidden': 'true',
    className: 'pid-icon',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '1.8',
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'requests':
      return (
        <svg {...sharedProps}>
          <path d="M4 6.5h16" />
          <path d="M4 12h16" />
          <path d="M4 17.5h10" />
        </svg>
      );
    case 'review':
      return (
        <svg {...sharedProps}>
          <path d="M12 3.5 5 7v5c0 4.3 2.4 7.2 7 8.5 4.6-1.3 7-4.2 7-8.5V7l-7-3.5Z" />
          <path d="m9.5 12 1.7 1.7 3.3-3.5" />
        </svg>
      );
    case 'debug':
      return (
        <svg {...sharedProps}>
          <path d="M9 3.5h6" />
          <path d="M10.5 8h3" />
          <path d="M7.5 8.5h9a3 3 0 0 1 3 3v3a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6v-3a3 3 0 0 1 3-3Z" />
          <path d="M5 12H3" />
          <path d="M21 12h-2" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...sharedProps}>
          <path d="M7 3.5h7l4 4V20.5H7Z" />
          <path d="M14 3.5v4h4" />
          <path d="M10 12h5" />
          <path d="M10 16h5" />
        </svg>
      );
    case 'api':
      return (
        <svg {...sharedProps}>
          <path d="m8 8-4 4 4 4" />
          <path d="m16 8 4 4-4 4" />
          <path d="m13 5-2 14" />
        </svg>
      );
    case 'health':
      return (
        <svg {...sharedProps}>
          <path d="M5 13.5h3l2-5 3 8 2-4h4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...sharedProps}>
          <path d="M12 4.5v3" />
          <path d="M12 16.5v3" />
          <path d="M4.5 12h3" />
          <path d="M16.5 12h3" />
          <circle cx="12" cy="12" r="3.25" />
        </svg>
      );
    case 'providers':
      return (
        <svg {...sharedProps}>
          <path d="M12 4 5 7.5 12 11l7-3.5Z" />
          <path d="M5 12.5 12 16l7-3.5" />
          <path d="M5 17.5 12 21l7-3.5" />
        </svg>
      );
    case 'trusted':
      return (
        <svg {...sharedProps}>
          <path d="M12 4 6 6.5v5.2c0 3.8 2.1 6.5 6 7.8 3.9-1.3 6-4 6-7.8V6.5Z" />
          <path d="M9.5 12h5" />
          <path d="M12 9.5v5" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...sharedProps}>
          <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.25" />
          <path d="M12 19.25v2.25" />
          <path d="m4.9 4.9 1.6 1.6" />
          <path d="m17.5 17.5 1.6 1.6" />
          <path d="M2.5 12h2.25" />
          <path d="M19.25 12h2.25" />
          <path d="m4.9 19.1 1.6-1.6" />
          <path d="m17.5 6.5 1.6-1.6" />
        </svg>
      );
    case 'overview':
    default:
      return (
        <svg {...sharedProps}>
          <rect x="4" y="4" width="7" height="7" rx="1.25" />
          <rect x="13" y="4" width="7" height="7" rx="1.25" />
          <rect x="4" y="13" width="7" height="7" rx="1.25" />
          <rect x="13" y="13" width="7" height="7" rx="1.25" />
        </svg>
      );
  }
}

function formatUpdatedAt(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
}

function summarizeRequests(requests) {
  return requests.reduce(
    (accumulator, request) => {
      accumulator.total += 1;

      if (request.status === 'manual_review') {
        accumulator.manualReview += 1;
      }

      if (request.status === 'ready_to_publish') {
        accumulator.ready += 1;
      }

      if (request.status === 'failed') {
        accumulator.failed += 1;
      }

      if (!accumulator.latestUpdatedAt || new Date(request.updated_at) > new Date(accumulator.latestUpdatedAt)) {
        accumulator.latestUpdatedAt = request.updated_at ?? accumulator.latestUpdatedAt;
      }

      return accumulator;
    },
    { total: 0, manualReview: 0, ready: 0, failed: 0, latestUpdatedAt: null },
  );
}

function buildDetailSummary(detail) {
  if (!detail) {
    return [];
  }

  return [
    ['Request', detail.id],
    ['Status', detail.status],
    ['Brand', detail.brand ?? '-'],
    ['Supplier', detail.supplier ?? '-'],
    ['Score', detail.final_score ?? '-'],
    ['Best candidate', detail.best_candidate?.id ?? '-'],
    ['Selected candidate', detail.selected_candidate?.id ?? '-'],
  ];
}

function fieldValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

const riskyRejectReasons = new Set(['WRONG_PRODUCT', 'WRONG_COLOR', 'WRONG_BRAND', 'LOW_CONFIDENCE']);
const rejectionReasons = [
  'LOW_RESOLUTION',
  'BLURRY_IMAGE',
  'WATERMARK_DETECTED',
  'TEXT_OVERLAY_DETECTED',
  'WRONG_PRODUCT',
  'WRONG_COLOR',
  'WRONG_BRAND',
  'LOW_CONFIDENCE',
  'SOURCE_NOT_ALLOWED',
  'DUPLICATE_WORSE_QUALITY',
  'ROBOTS_OR_PERMISSION_BLOCKED',
  'DOWNLOAD_FAILED',
  'INVALID_MIME_TYPE',
];

function candidateImageUrl(candidateId) {
  return `/admin/product-image-discovery/candidates/${candidateId}/image`;
}

async function fetchOverviewData(signal) {
  const [summaryResult, requestsResult] = await Promise.all([
    pidFetch('/dashboard-summary', { signal }),
    pidFetch('/requests/search?per_page=8', { signal }),
  ]);

  return {
    summary: summaryResult ?? DEFAULT_SUMMARY,
    requests: normalizeLaravelPagination(requestsResult).data,
  };
}

async function fetchRequestList(filters, signal) {
  const result = await pidFetch(buildRequestSearchPath(filters), { signal });

  return normalizeLaravelPagination(result).data;
}

async function fetchRequestDetail(requestId, signal) {
  const [detailResult, eventsResult, candidatesResult] = await Promise.all([
    pidFetch(`/requests/${requestId}`, { signal }),
    pidFetch(`/requests/${requestId}/events`, { signal }),
    pidFetch(`/requests/${requestId}/candidates`, { signal }),
  ]);

  return {
    detail: detailResult.data ?? detailResult,
    events: normalizeLaravelPagination(eventsResult).data,
    candidates: normalizeLaravelPagination(candidatesResult).data,
  };
}

function Sidebar({ page, onPage }) {
  return (
    <aside className="pid-sidebar" aria-label="Product image discovery sidebar" data-testid="pid-shell-sidebar">
      <div className="pid-brand">
        <div className="pid-brand__mark">P</div>
        <div>
          <div className="pid-brand__name">Product Images</div>
          <div className="pid-brand__sub">Admin console</div>
        </div>
      </div>
      <nav className="pid-nav" aria-label="Product image discovery sections">
        {navGroups.map((group) => (
          <section className="pid-nav__group" key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`pid-nav__item ${page === item.id ? 'is-active' : ''}`}
                onClick={() => onPage(item.id)}
                aria-label={`${item.label} section`}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <span className="pid-nav__icon" aria-hidden="true">
                  <ShellIcon name={item.icon} />
                </span>
                <span className="pid-nav__copy">
                  <span className="pid-nav__label">{item.label}</span>
                  <span className="pid-nav__meta">{item.meta}</span>
                </span>
              </button>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({ page, theme, onTheme, loading, requests }) {
  const title = page.label;
  const toggleTarget = theme === 'dark' ? 'light' : 'dark';
  const requestSummary = summarizeRequests(requests);

  return (
    <header className="pid-topbar" data-testid="pid-shell-header">
      <div className="pid-topbar__heading">
        <div className="pid-crumbs">Product Images / <span>{title}</span></div>
        <h1>{title}</h1>
        <p className="pid-topbar__summary">{page.meta}</p>
      </div>
      <div className="pid-topbar__actions">
        <div className="pid-topbar__status" aria-label="Workspace status">
          <span className="pid-env">local</span>
          <span className="pid-env pid-env--accent">{loading ? 'syncing' : `${requestSummary.total} tracked`}</span>
          <span className="pid-env">{requestSummary.manualReview} review</span>
          <span className="pid-env">{requestSummary.ready} ready</span>
        </div>
        <button
          type="button"
          className="pid-icon-button"
          onClick={onTheme}
          aria-label={`Switch to ${toggleTarget} theme`}
          title={`Switch to ${toggleTarget} theme`}
        >
          <ShellIcon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}

function Overview({ summary, requests, loading, error }) {
  const counts = summary?.counts ?? {};
  const providers = summary?.provider_status ?? [];
  const requestSummary = summarizeRequests(requests);

  return (
    <div className="pid-stack">
      {error ? (
        <div className="pid-alert pid-alert--danger" role="alert">
          {error}
        </div>
      ) : null}

      <section className="pid-kpis" aria-label="Request KPIs">
        {[
          ['Total', counts.total],
          ['Manual review', counts.manual_review],
          ['Ready', counts.ready_to_publish],
          ['Failed', counts.failed],
          ['No candidates', counts.no_candidates_found],
        ].map(([label, value]) => (
          <div className="pid-kpi" key={label}>
            <span>{label}</span>
            <strong>{loading ? '-' : value ?? 0}</strong>
          </div>
        ))}
      </section>

      <section className="pid-overview-grid" aria-label="Overview details">
        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>Provider Health</h2>
            <span>{providers.length} configured</span>
          </div>
          <div className="pid-provider-list">
            {providers.length === 0 ? (
              <p className="pid-empty">No providers seeded yet.</p>
            ) : providers.map((provider) => (
              <div className="pid-provider" key={provider.code}>
                <div>
                  <strong>{provider.code}</strong>
                  <span>{provider.driver}</span>
                </div>
                <StatusBadge status={provider.active ? 'ready_to_publish' : 'pending'} />
                <span className="pid-muted">{provider.has_api_key ? 'key configured' : 'key missing'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>Queue Snapshot</h2>
            <span>{loading ? 'Loading' : `${requestSummary.total} tracked`}</span>
          </div>
          <div className="pid-metric-grid">
            <div className="pid-metric">
              <span>Ready to publish</span>
              <strong>{loading ? '-' : requestSummary.ready}</strong>
            </div>
            <div className="pid-metric">
              <span>Manual review</span>
              <strong>{loading ? '-' : requestSummary.manualReview}</strong>
            </div>
            <div className="pid-metric">
              <span>Failed</span>
              <strong>{loading ? '-' : requestSummary.failed}</strong>
            </div>
            <div className="pid-metric">
              <span>Latest update</span>
              <strong className="pid-metric__text">{loading ? '-' : formatUpdatedAt(requestSummary.latestUpdatedAt)}</strong>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

function RequestFilters({ filters, onChange, onReset, activeChips, loading }) {
  const update = (name, value) => {
    onChange({ ...filters, [name]: value });
  };

  return (
    <section className="pid-panel">
      <div className="pid-panel__header">
        <h2>Search Filters</h2>
        <span>{loading ? 'Syncing' : `${activeChips.length} active`}</span>
      </div>
      <div className="pid-filters">
        <label>
          <span>Client</span>
          <input value={filters.client_id} onChange={(event) => update('client_id', event.target.value)} placeholder="1" />
        </label>
        <label>
          <span>Brand</span>
          <input value={filters.brand} onChange={(event) => update('brand', event.target.value)} placeholder="Herno" />
        </label>
        <label>
          <span>Supplier</span>
          <input value={filters.supplier} onChange={(event) => update('supplier', event.target.value)} placeholder="Supplier name" />
        </label>
        <label>
          <span>Status</span>
          <input value={filters.status} onChange={(event) => update('status', event.target.value)} placeholder="manual_review" />
        </label>
        <label>
          <span>ERP model</span>
          <input value={filters.erp_model_id} onChange={(event) => update('erp_model_id', event.target.value)} placeholder="MODEL-123" />
        </label>
        <label>
          <span>ERP model color</span>
          <input
            value={filters.erp_model_color_id}
            onChange={(event) => update('erp_model_color_id', event.target.value)}
            placeholder="MODEL-123-BLACK"
          />
        </label>
        <label>
          <span>EAN / barcode</span>
          <input value={filters.ean} onChange={(event) => update('ean', event.target.value)} placeholder="8001234567890" />
        </label>
        <label>
          <span>Source domain</span>
          <input value={filters.source_domain} onChange={(event) => update('source_domain', event.target.value)} placeholder="cdn.example.com" />
        </label>
        <label>
          <span>Rejection reason</span>
          <input value={filters.rejection_reason} onChange={(event) => update('rejection_reason', event.target.value)} placeholder="wrong_color" />
        </label>
        <label>
          <span>Min score</span>
          <input type="number" min="0" max="100" value={filters.min_score} onChange={(event) => update('min_score', event.target.value)} />
        </label>
        <label>
          <span>Max score</span>
          <input type="number" min="0" max="100" value={filters.max_score} onChange={(event) => update('max_score', event.target.value)} />
        </label>
        <label>
          <span>Per page</span>
          <select value={filters.per_page} onChange={(event) => update('per_page', event.target.value)}>
            {['10', '15', '25', '50'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select value={filters.sort_by} onChange={(event) => update('sort_by', event.target.value)}>
            {['created_at', 'updated_at', 'final_score', 'status', 'brand', 'supplier', 'client_id'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select value={filters.sort_direction} onChange={(event) => update('sort_direction', event.target.value)}>
            {['desc', 'asc'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Manual review only</span>
          <select value={filters.manual_review_required} onChange={(event) => update('manual_review_required', event.target.value)}>
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>
          <span>Has candidates</span>
          <select value={filters.has_candidates} onChange={(event) => update('has_candidates', event.target.value)}>
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>
          <span>Has selected image</span>
          <select value={filters.has_selected_image} onChange={(event) => update('has_selected_image', event.target.value)}>
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>
          <span>Created from</span>
          <input type="date" value={filters.created_from} onChange={(event) => update('created_from', event.target.value)} />
        </label>
        <label>
          <span>Created to</span>
          <input type="date" value={filters.created_to} onChange={(event) => update('created_to', event.target.value)} />
        </label>
        <label>
          <span>Updated from</span>
          <input type="date" value={filters.updated_from} onChange={(event) => update('updated_from', event.target.value)} />
        </label>
        <label>
          <span>Updated to</span>
          <input type="date" value={filters.updated_to} onChange={(event) => update('updated_to', event.target.value)} />
        </label>
      </div>
      <div className="pid-filter-actions">
        <FilterBar label="Active filters" filters={activeChips} onClear={onReset} />
      </div>
    </section>
  );
}

function RejectCandidateModal({
  open,
  candidate,
  reason,
  notes,
  error,
  onReasonChange,
  onNotesChange,
  onCancel,
  onConfirm,
}) {
  if (!open || !candidate) {
    return null;
  }

  return (
    <div className="pid-modal" role="dialog" aria-modal="true" aria-label={`Reject candidate ${candidate.id}`}>
      <div className="pid-modal__panel">
        <strong>Reject candidate {candidate.id}</strong>
        <p>Pick the rejection reason and add notes when the reason needs operator context.</p>
        {error ? <div className="pid-alert pid-alert--danger" role="alert">{error}</div> : null}
        <div className="pid-modal__form">
          <label>
            <span>Reason</span>
            <select value={reason} onChange={(event) => onReasonChange(event.target.value)}>
              <option value="">Select a reason</option>
              {rejectionReasons.map((value) => (
                <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <textarea
              rows="4"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Explain why this candidate is wrong."
            />
          </label>
          {reason && riskyRejectReasons.has(reason) ? (
            <p className="pid-modal__help">Notes are required for color, brand, product, and low-confidence rejects.</p>
          ) : null}
        </div>
        <div className="pid-modal__actions">
          <button type="button" className="pid-chip-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="pid-chip-button pid-chip-button--accent" onClick={onConfirm}>Reject</button>
        </div>
      </div>
    </div>
  );
}

function RequestDetailDrawer({
  open,
  detail,
  events,
  candidates,
  loading,
  error,
  onClose,
  onApproveCandidate,
  onRejectCandidate,
  onRetryRequest,
  compareCandidateId,
  onCompareCandidateIdChange,
}) {
  const detailSummary = buildDetailSummary(detail);
  const selectedCandidate = detail?.selected_candidate ?? null;
  const bestCandidate = detail?.best_candidate ?? null;
  const compareCandidate = candidates.find((candidate) => String(candidate.id) === String(compareCandidateId))
    ?? candidates[0]
    ?? null;
  const requestCanRetry = detail && !['published', 'ready_to_publish'].includes(detail.status);
  const eventTimeline = events.map((event) => ({
    id: event.id,
    title: event.event_type,
    detail: `${event.message}${event.level ? ` • ${event.level}` : ''}`,
  }));

  return (
    <Drawer open={open} title={detail ? `Request ${detail.id}` : 'Request detail'} onClose={onClose}>
      {loading ? <EmptyState title="Loading request detail" description="Fetching request, candidates, and events." /> : null}
      {error ? <div className="pid-alert pid-alert--danger" role="alert">{error}</div> : null}
      {!loading && detail ? (
        <div className="pid-detail-grid">
          <section className="pid-panel pid-panel--flat">
            <div className="pid-panel__header">
              <h2>Actions</h2>
              <span>{requestCanRetry ? 'Mutable' : 'Terminal'}</span>
            </div>
            <div className="pid-detail-actions">
              <button
                type="button"
                className="pid-chip-button"
                onClick={() => onRetryRequest(detail)}
                disabled={!requestCanRetry}
              >
                Retry request
              </button>
            </div>
          </section>

          <section className="pid-panel pid-panel--flat">
            <div className="pid-panel__header">
              <h2>Summary</h2>
              <StatusBadge status={detail.status} />
            </div>
            <div className="pid-detail-summary">
              {detailSummary.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{fieldValue(value)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="pid-panel pid-panel--flat">
            <div className="pid-panel__header">
              <h2>Candidates</h2>
              <span>{candidates.length} rows</span>
            </div>
            <div className="pid-detail-candidates">
              {candidates.length === 0 ? (
                <EmptyState title="No candidates" description="This request has no candidate rows yet." />
              ) : candidates.map((candidate) => (
                <div className="pid-detail-candidate" key={candidate.id}>
                  <ImageTile
                    src={candidateImageUrl(candidate.id)}
                    alt={`Candidate ${candidate.id} preview`}
                    status={candidate.status}
                    caption={`${candidate.source_domain} • ${candidate.final_score ?? '-'} score`}
                  />
                  <div className="pid-detail-candidate__meta">
                    <strong>{candidate.source_domain}</strong>
                    <span>{candidate.source_page_url}</span>
                    <span className="pid-muted">Rejection: {fieldValue(candidate.rejection_reason)}</span>
                  </div>
                  <ScorePill score={candidate.final_score} />
                  <StatusBadge status={candidate.id === selectedCandidate?.id ? 'published' : candidate.id === bestCandidate?.id ? 'ready_to_publish' : candidate.status} />
                  <div className="pid-detail-candidate__actions">
                    <button type="button" className="pid-chip-button pid-chip-button--accent" onClick={() => onApproveCandidate(candidate)}>
                      Approve
                    </button>
                    <button type="button" className="pid-chip-button" onClick={() => onRejectCandidate(candidate)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {compareCandidate ? (
            <section className="pid-panel pid-panel--flat">
              <div className="pid-panel__header">
                <h2>Compare mode</h2>
                <select
                  aria-label="Compare candidate"
                  value={String(compareCandidate.id)}
                  onChange={(event) => onCompareCandidateIdChange(event.target.value)}
                >
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      Candidate {candidate.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pid-compare-grid">
                <article className="pid-compare-card">
                  <div className="pid-panel__header">
                    <h3>Selected</h3>
                    <StatusBadge status={selectedCandidate?.status ?? detail.status} />
                  </div>
                  {selectedCandidate ? (
                    <>
                      <ImageTile
                        src={candidateImageUrl(selectedCandidate.id)}
                        alt={`Selected candidate ${selectedCandidate.id} preview`}
                        status={selectedCandidate.status}
                        caption={`${selectedCandidate.source_domain} • ${selectedCandidate.final_score ?? '-'} score`}
                      />
                      <div className="pid-detail-candidate__meta">
                        <strong>{selectedCandidate.source_domain}</strong>
                        <span>{selectedCandidate.source_page_url}</span>
                        <span className="pid-muted">Rejection: {fieldValue(selectedCandidate.rejection_reason)}</span>
                      </div>
                    </>
                  ) : (
                    <EmptyState title="No selected candidate" description="Nothing has been approved yet." />
                  )}
                </article>
                <article className="pid-compare-card">
                  <div className="pid-panel__header">
                    <h3>Under review</h3>
                    <StatusBadge status={compareCandidate.status} />
                  </div>
                  <ImageTile
                    src={candidateImageUrl(compareCandidate.id)}
                    alt={`Candidate ${compareCandidate.id} preview`}
                    status={compareCandidate.status}
                    caption={`${compareCandidate.source_domain} • ${compareCandidate.final_score ?? '-'} score`}
                  />
                  <div className="pid-detail-candidate__meta">
                    <strong>{compareCandidate.source_domain}</strong>
                    <span>{compareCandidate.source_page_url}</span>
                    <span className="pid-muted">Rejection: {fieldValue(compareCandidate.rejection_reason)}</span>
                    <span className="pid-muted">Mime: {fieldValue(compareCandidate.mime_type)} • {fieldValue(compareCandidate.width)} x {fieldValue(compareCandidate.height)}</span>
                  </div>
                  <div className="pid-compare-card__actions">
                    <button
                      type="button"
                      className="pid-chip-button"
                      onClick={() => window.open(compareCandidate.source_page_url, '_blank', 'noopener,noreferrer')}
                    >
                      Open source
                    </button>
                    <button
                      type="button"
                      className="pid-chip-button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(compareCandidate.image_url);
                        } catch (err) {
                          void err;
                        }
                      }}
                    >
                      Copy image URL
                    </button>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          <section className="pid-panel pid-panel--flat">
            <div className="pid-panel__header">
              <h2>Events</h2>
              <span>{events.length} items</span>
            </div>
            <div className="pid-detail-events">
              {events.length === 0 ? (
                <EmptyState title="No events" description="The selected request has no events yet." />
              ) : (
                <Timeline items={eventTimeline} />
              )}
            </div>
          </section>

          <JsonViewer value={detail} label="Request payload" />
        </div>
      ) : null}
    </Drawer>
  );
}

function Requests({
  requests,
  loading,
  title = 'Latest Requests',
  filters,
  onFiltersChange,
  activeChips,
  onClearFilters,
  onOpenRequest,
  detailState,
  error,
  manualReviewOnly = false,
}) {
  const requestSummary = summarizeRequests(requests);
  const columns = [
    {
      key: 'open',
      label: '',
      className: 'pid-table__action',
      render: (request) => (
        <button type="button" className="pid-chip-button" onClick={() => onOpenRequest(request)}>
          Open
        </button>
      ),
    },
    { key: 'status', label: 'Status', render: (request) => <StatusBadge status={request.status} /> },
    { key: 'score', label: 'Score', render: (request) => <ScorePill score={request.final_score} /> },
    { key: 'brand', label: 'Brand' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'erp_model_color_id', label: 'ERP model color', render: (request) => <code>{request.erp_model_color_id}</code> },
    { key: 'updated_at', label: 'Updated', render: (request) => formatUpdatedAt(request.updated_at) },
  ];

  return (
    <div className="pid-stack">
      {error ? (
        <div className="pid-alert pid-alert--danger" role="alert">
          {error}
        </div>
      ) : null}
      {manualReviewOnly ? (
        <div className="pid-alert pid-alert--info">
          Manual review is pinned on this view.
        </div>
      ) : null}
      <RequestFilters
        filters={filters}
        onChange={onFiltersChange}
        onReset={onClearFilters}
        activeChips={activeChips}
        loading={loading}
      />
      <section className="pid-request-summary" aria-label="Request summary">
        {[
          ['Tracked', requestSummary.total],
          ['Manual review', requestSummary.manualReview],
          ['Ready', requestSummary.ready],
          ['Failed', requestSummary.failed],
        ].map(([label, value]) => (
          <div className="pid-kpi pid-kpi--compact" key={label}>
            <span>{label}</span>
            <strong>{loading ? '-' : value}</strong>
          </div>
        ))}
      </section>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>{title}</h2>
          <span>{loading ? 'Loading' : `${requests.length} rows`}</span>
        </div>
        <DataTable
          ariaLabel="Discovery requests"
          columns={columns}
          rows={requests}
          loading={loading}
          emptyTitle="No discovery requests yet"
          emptyDescription="The shell is connected, but no discovery requests were returned."
        />
      </section>
      <RequestDetailDrawer {...detailState} onClose={detailState.onClose} />
    </div>
  );
}

function PlaceholderPage({ page }) {
  return (
    <div className="pid-stack">
      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>{page.label}</h2>
          <span>Next slice</span>
        </div>
        <div className="pid-placeholder">
          <p className="pid-muted">{page.meta}</p>
          <ul className="pid-placeholder__list">
            <li>Keep the wrapper response shape visible inside the shell.</li>
            <li>Favor dense tables, filters, and diagnostics over broad explanatory text.</li>
            <li>Use this section as a stable mount point for the next Macro 1 frontend step.</li>
          </ul>
        </div>
      </section>
      <JsonViewer value={{ page, hint: 'Diagnostics surfaces land in the next slice.' }} label="Page payload preview" />
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;

    if (path.includes('/review')) {
      return 'review';
    }

    if (path.includes('/requests')) {
      return 'requests';
    }

    return 'overview';
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('pid-admin-theme') || 'light');
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [overviewRequests, setOverviewRequests] = useState([]);
  const [requestRows, setRequestRows] = useState([]);
  const [requestFilters, setRequestFilters] = useState(() => requestFiltersFromSearchParams(new URLSearchParams(window.location.search)));
  const [requestLoading, setRequestLoading] = useState(true);
  const [requestError, setRequestError] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState(null);
  const [detailCandidates, setDetailCandidates] = useState([]);
  const [detailEvents, setDetailEvents] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [compareCandidateId, setCompareCandidateId] = useState(null);
  const [approveCandidate, setApproveCandidate] = useState(null);
  const [rejectCandidate, setRejectCandidate] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [retryRequest, setRetryRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pid-admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    const params = requestFiltersToSearchParams(
      page === 'review' ? { ...requestFilters, manual_review_required: 'true' } : requestFilters,
    );
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [page, requestFilters]);

  const effectiveRequestFilters = useMemo(() => {
    if (page === 'review') {
      return { ...requestFilters, manual_review_required: 'true' };
    }

    return requestFilters;
  }, [page, requestFilters]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');

      const [summaryResult, requestsResult] = await Promise.allSettled([
        pidFetch('/dashboard-summary', { signal: controller.signal }),
        pidFetch('/requests/search?per_page=8', { signal: controller.signal }),
      ]);

      if (cancelled) {
        return;
      }

      const warnings = [];

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value ?? DEFAULT_SUMMARY);
      } else {
        setSummary(DEFAULT_SUMMARY);
        warnings.push('Dashboard summary is unavailable.');
      }

      if (requestsResult.status === 'fulfilled') {
        setOverviewRequests(normalizeLaravelPagination(requestsResult.value).data);
      } else {
        setOverviewRequests([]);
        warnings.push('Requests list is unavailable.');
      }

      setError(warnings.join(' '));
      setLoading(false);
    }

    load().catch((err) => {
      if (!cancelled && err.name !== 'AbortError') {
        setSummary(DEFAULT_SUMMARY);
        setOverviewRequests([]);
        setRequestRows([]);
        setError(err.message || 'Unable to load admin data.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setRequestLoading(true);
      setRequestError('');

      try {
        const result = await fetchRequestList(effectiveRequestFilters, controller.signal);

        if (!cancelled) {
          setRequestRows(result);
          setRequestLoading(false);
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setRequestRows([]);
          setRequestError(err.message || 'Unable to load requests.');
          setRequestLoading(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [effectiveRequestFilters]);

  async function openRequest(request) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailRequest(null);
    setDetailCandidates([]);
    setDetailEvents([]);
    setCompareCandidateId(null);
    setApproveCandidate(null);
    setRejectCandidate(null);
    setRejectReason('');
    setRejectNotes('');
    setRetryRequest(null);
    setActionError('');

    try {
      const result = await fetchRequestDetail(request.id);

      setDetailRequest(result.detail);
      setDetailCandidates(result.candidates);
      setDetailEvents(result.events);
      setCompareCandidateId((current) => {
        if (current && result.candidates.some((candidate) => String(candidate.id) === String(current))) {
          return current;
        }

        return result.candidates[0]?.id ?? null;
      });
    } catch (err) {
      setDetailError(err.message || 'Unable to load request detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function reloadOverview() {
    setLoading(true);
    setError('');

    try {
      const result = await fetchOverviewData();
      setSummary(result.summary ?? DEFAULT_SUMMARY);
      setOverviewRequests(result.requests ?? []);
    } catch (err) {
      setSummary(DEFAULT_SUMMARY);
      setOverviewRequests([]);
      setError(err.message || 'Unable to refresh overview.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentRequest() {
    if (!detailRequest?.id) {
      return;
    }

    setDetailLoading(true);
    setDetailError('');

    try {
      const result = await fetchRequestDetail(detailRequest.id);
      setDetailRequest(result.detail);
      setDetailCandidates(result.candidates);
      setDetailEvents(result.events);
      setCompareCandidateId((current) => {
        if (current && result.candidates.some((candidate) => String(candidate.id) === String(current))) {
          return current;
        }

        return result.candidates[0]?.id ?? null;
      });
    } catch (err) {
      setDetailError(err.message || 'Unable to refresh request detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  function notify(message, tone = 'neutral') {
    setToast({ message, tone });
  }

  async function submitCandidateApprove(candidate) {
    if (actionLoading || !detailRequest?.id || !candidate?.id) {
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await pidFetch(`/requests/${detailRequest.id}/candidates/${candidate.id}/approve`, {
        method: 'POST',
      });
      notify(`Candidate ${candidate.id} approved.`, 'success');
      setActionError('');
      await Promise.all([reloadOverview(), refreshCurrentRequest()]);
      setApproveCandidate(null);
    } catch (err) {
      setActionError(err.message || 'Unable to approve candidate.');
      notify(err.message || 'Unable to approve candidate.', 'danger');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitCandidateReject() {
    if (actionLoading || !detailRequest?.id || !rejectCandidate?.id) {
      return;
    }

    if (!rejectReason) {
      setActionError('Select a rejection reason.');
      return;
    }

    if (riskyRejectReasons.has(rejectReason) && !rejectNotes.trim()) {
      setActionError('Notes are required for this rejection reason.');
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await pidFetch(`/requests/${detailRequest.id}/candidates/${rejectCandidate.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: rejectReason,
          notes: rejectNotes.trim() || null,
        }),
      });
      notify(`Candidate ${rejectCandidate.id} rejected.`, 'success');
      setActionError('');
      await Promise.all([reloadOverview(), refreshCurrentRequest()]);
      setRejectCandidate(null);
      setRejectReason('');
      setRejectNotes('');
    } catch (err) {
      setActionError(err.message || 'Unable to reject candidate.');
      notify(err.message || 'Unable to reject candidate.', 'danger');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitRequestRetry(requestRecord) {
    if (actionLoading || !requestRecord?.id) {
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await pidFetch(`/requests/${requestRecord.id}/retry`, {
        method: 'POST',
      });
      notify(`Request ${requestRecord.id} queued for retry.`, 'success');
      setActionError('');
      await Promise.all([reloadOverview(), refreshCurrentRequest()]);
      setRetryRequest(null);
      setRequestFilters((current) => ({ ...current }));
    } catch (err) {
      setActionError(err.message || 'Unable to retry request.');
      notify(err.message || 'Unable to retry request.', 'danger');
    } finally {
      setActionLoading(false);
    }
  }

  function closeDetailDrawer() {
    setDetailOpen(false);
    setDetailRequest(null);
    setDetailCandidates([]);
    setDetailEvents([]);
    setDetailError('');
    setApproveCandidate(null);
    setRejectCandidate(null);
    setRejectReason('');
    setRejectNotes('');
    setRetryRequest(null);
    setActionError('');
  }

  function clearFilters() {
    setRequestFilters(createDefaultRequestFilters());
  }

  const currentPage = pageIndex[page] ?? pageIndex.overview;

  const body = useMemo(() => {
    if (page === 'overview') {
      return <Overview summary={summary} requests={overviewRequests} loading={loading} error={error} />;
    }

    if (page === 'requests') {
      return (
        <Requests
          requests={requestRows}
          loading={requestLoading}
          title="Latest Requests"
          filters={effectiveRequestFilters}
          onFiltersChange={setRequestFilters}
          activeChips={requestFiltersToActiveChips(effectiveRequestFilters)}
          onClearFilters={clearFilters}
          onOpenRequest={openRequest}
          error={requestError}
          detailState={{
            open: detailOpen,
            detail: detailRequest,
            events: detailEvents,
            candidates: detailCandidates,
            loading: detailLoading,
            error: detailError,
            onClose: closeDetailDrawer,
            onApproveCandidate: setApproveCandidate,
            onRejectCandidate: (candidate) => {
              setRejectCandidate(candidate);
              setRejectReason('');
              setRejectNotes('');
              setActionError('');
            },
            onRetryRequest: setRetryRequest,
            compareCandidateId,
            onCompareCandidateIdChange: setCompareCandidateId,
          }}
        />
      );
    }

    if (page === 'review') {
      return (
        <Requests
          requests={requestRows.filter((request) => request.status === 'manual_review')}
          loading={requestLoading}
          title="Manual Review Queue"
          filters={effectiveRequestFilters}
          onFiltersChange={(next) => setRequestFilters({ ...next, manual_review_required: next.manual_review_required || 'true' })}
          activeChips={requestFiltersToActiveChips(effectiveRequestFilters)}
          onClearFilters={clearFilters}
          onOpenRequest={openRequest}
          error={requestError}
          detailState={{
            open: detailOpen,
            detail: detailRequest,
            events: detailEvents,
            candidates: detailCandidates,
            loading: detailLoading,
            error: detailError,
            onClose: closeDetailDrawer,
            onApproveCandidate: setApproveCandidate,
            onRejectCandidate: (candidate) => {
              setRejectCandidate(candidate);
              setRejectReason('');
              setRejectNotes('');
              setActionError('');
            },
            onRetryRequest: setRetryRequest,
            compareCandidateId,
            onCompareCandidateIdChange: setCompareCandidateId,
          }}
          manualReviewOnly
        />
      );
    }

    return <PlaceholderPage page={currentPage} />;
  }, [clearFilters, currentPage, detailCandidates, detailError, detailEvents, detailLoading, detailRequest, effectiveRequestFilters, error, loading, openRequest, page, requestLoading, requestRows, summary, overviewRequests]);

  return (
    <div className="pid-app">
      <Sidebar page={page} onPage={setPage} />
      <div className="pid-main">
        <Topbar
          page={currentPage}
          theme={theme}
          onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          loading={loading}
          requests={overviewRequests}
        />
        <main className="pid-content" data-testid="pid-shell-content">{body}</main>
      </div>
      <ConfirmModal
        open={Boolean(approveCandidate)}
        title={approveCandidate ? `Approve candidate ${approveCandidate.id}` : 'Approve candidate'}
        description={approveCandidate ? `Promote candidate ${approveCandidate.id} to the selected image for request ${detailRequest?.id}.` : 'Approve the current candidate.'}
        confirmLabel={actionLoading ? 'Working...' : 'Approve'}
        onCancel={() => setApproveCandidate(null)}
        onConfirm={() => submitCandidateApprove(approveCandidate)}
      />
      <RejectCandidateModal
        open={Boolean(rejectCandidate)}
        candidate={rejectCandidate}
        reason={rejectReason}
        notes={rejectNotes}
        error={actionError}
        onReasonChange={setRejectReason}
        onNotesChange={setRejectNotes}
        onCancel={() => {
          setRejectCandidate(null);
          setRejectReason('');
          setRejectNotes('');
          setActionError('');
        }}
        onConfirm={submitCandidateReject}
      />
      <ConfirmModal
        open={Boolean(retryRequest)}
        title={retryRequest ? `Retry request ${retryRequest.id}` : 'Retry request'}
        description={retryRequest ? 'Requeue this request through the package pipeline.' : 'Retry the current request.'}
        confirmLabel={actionLoading ? 'Working...' : 'Retry'}
        onCancel={() => setRetryRequest(null)}
        onConfirm={() => submitRequestRetry(retryRequest)}
      />
      <Toast open={Boolean(toast)} tone={toast?.tone}>{toast?.message}</Toast>
    </div>
  );
}
