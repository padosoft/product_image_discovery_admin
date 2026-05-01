import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pidFetch, normalizeLaravelPagination, buildRequestSearchPath, buildAdminApiPath, normalizeAdminApiBase } from './api';
import { DataTable } from './components/DataTable';
import { ConfirmModal } from './components/ConfirmModal';
import { Drawer } from './components/Drawer';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { ImageTile } from './components/ImageTile';
import { JsonViewer } from './components/JsonViewer';
import { LoadingState } from './components/LoadingState';
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
import {
  DEFAULT_SETTING_FORM,
  SETTING_VALUE_TYPES,
  buildSettingPayload,
  settingToForm,
} from './settings-form';
import {
  DEFAULT_PROVIDER_FORM,
  PROVIDER_DRIVERS,
  PROVIDER_SECRET_MODES,
  buildProviderPayload,
  providerToForm,
  redactProviderPayloadPreview,
} from './provider-form';
import {
  DEFAULT_TRUSTED_SOURCE_FORM,
  TRUSTED_SOURCE_TYPES,
  buildTrustedSourcePayload,
  trustedSourceToForm,
} from './trusted-source-form';

const DEFAULT_SUMMARY = {
  counts: {},
  provider_status: [],
};

const DEBUG_DRAFT_KEY = 'pid-debug-flow-draft';
const DEFAULT_DEBUG_REQUEST = {
  client_id: 1,
  erp_model_id: 'HERNO-PI002223D',
  erp_model_color_id: 'HERNO-PI002223D-CAMMELLO',
  brand: 'Herno',
  supplier: 'Herno',
  supplier_sku: 'PI002223D',
  model_code: 'PI002223D',
  color_code: 'CAMMELLO',
  color_name: 'Cammello',
  category: 'Donna > Maglie e camicie',
};

const DEFAULT_DEBUG_OPTIONS = {
  max_candidates: '2',
  fresh: true,
  clean_storage: false,
  no_download: true,
  download_all: false,
  stop_on_first_good: false,
  exhaustive: false,
  good_score: '',
  no_env_brave: true,
  fail_on_no_match: false,
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

function pageFromPath(pathname) {
  const pageIds = new Set(Object.keys(pageIndex));
  const segments = String(pathname || '').split('/').filter(Boolean).reverse();

  return segments.find((segment) => pageIds.has(segment) && segment !== 'overview') ?? 'overview';
}

function pathForPage(page) {
  const base = normalizeAdminApiBase();

  if (page === 'overview') {
    return base;
  }

  return `${base}/${page}`;
}

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
  return buildAdminApiPath(`/candidates/${encodeURIComponent(candidateId)}/image`);
}

function safeExternalHttpUrl(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  try {
    const url = new URL(rawValue, window.location.origin);

    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (err) {
    void err;

    return '';
  }
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

async function fetchSettings(signal) {
  const result = await pidFetch('/settings', { signal });

  return normalizeLaravelPagination(result).data;
}

async function fetchPaginatedAdminRecords(path, signal) {
  const records = [];
  let page = 1;
  let lastPage = 1;

  do {
    const separator = path.includes('?') ? '&' : '?';
    const result = await pidFetch(`${path}${separator}page=${page}`, { signal });
    const pagination = normalizeLaravelPagination(result);
    records.push(...pagination.data);
    lastPage = Number(pagination.meta?.last_page ?? page);
    page += 1;
  } while (page <= lastPage);

  return records;
}

async function fetchSearchProviders(signal) {
  return fetchPaginatedAdminRecords('/search-providers?per_page=100', signal);
}

async function fetchTrustedSources(signal) {
  return fetchPaginatedAdminRecords('/trusted-sources?per_page=100', signal);
}

async function fetchDebugRuns(signal) {
  const result = await pidFetch('/debug-runs', { signal });

  return result?.data ?? [];
}

async function fetchDebugRun(debugRunId, signal) {
  const result = await pidFetch(`/debug-runs/${debugRunId}`, { signal });

  return result?.data ?? result;
}

async function fetchDebugRunReport(debugRunId, signal) {
  const result = await pidFetch(`/debug-runs/${debugRunId}/report`, { signal });

  return result?.data ?? result;
}

async function createDebugRun(payload) {
  const result = await pidFetch('/debug-runs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return result?.data ?? result;
}

async function fetchHealth(signal) {
  const result = await pidFetch('/health', { signal });

  return result?.data ?? result;
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

function RequestFilters({ filters, onChange, onReset, activeChips, loading, manualReviewLocked = false }) {
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
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={filters.client_id}
            onChange={(event) => update('client_id', event.target.value)}
            placeholder="1"
          />
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
          <input value={filters.rejection_reason} onChange={(event) => update('rejection_reason', event.target.value)} placeholder="WRONG_COLOR" />
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
          <select
            value={manualReviewLocked ? 'true' : filters.manual_review_required}
            onChange={(event) => update('manual_review_required', event.target.value)}
            disabled={manualReviewLocked}
            title={manualReviewLocked ? 'Manual review is pinned on this view' : undefined}
          >
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
  const compareSourceUrl = compareCandidate ? safeExternalHttpUrl(compareCandidate.source_page_url) : '';
  const requestCanRetry = detail && ['failed', 'no_candidates_found'].includes(detail.status);
  const eventTimeline = events.map((event) => {
    const detail = [event.message, event.level]
      .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
      .join(' • ');

    return {
      id: event.id,
      title: event.event_type,
      detail: detail || '-',
    };
  });

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
                      onClick={() => {
                        if (compareSourceUrl) {
                          window.open(compareSourceUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      disabled={!compareSourceUrl}
                      title={compareSourceUrl ? 'Open source' : 'Unsafe or missing source URL'}
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
        manualReviewLocked={manualReviewOnly}
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

function settingScope(setting) {
  return setting.client_id ? `Client ${setting.client_id}` : 'Global';
}

function settingValuePreview(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  const preview = typeof value === 'object' ? JSON.stringify(value) : String(value);

  return preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;
}

function SettingsPage({ onNotify }) {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => ({ ...DEFAULT_SETTING_FORM }));
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteSetting, setDeleteSetting] = useState(null);
  const mountedRef = useRef(true);
  const settingsReloadIdRef = useRef(0);

  const formPayload = useMemo(() => buildSettingPayload(form), [form]);
  const previewValue = formPayload.ok ? formPayload.value : { error: formPayload.error };

  async function reloadSettings(signal) {
    if (!mountedRef.current || signal?.aborted) {
      return;
    }

    const reloadId = settingsReloadIdRef.current + 1;
    settingsReloadIdRef.current = reloadId;
    const isCurrentReload = () => (
      mountedRef.current
      && settingsReloadIdRef.current === reloadId
      && !signal?.aborted
    );

    setLoading(true);
    setError('');

    try {
      const result = await fetchSettings(signal);

      if (!isCurrentReload()) {
        return;
      }

      setSettings(result);
    } catch (err) {
      if (isCurrentReload() && err.name !== 'AbortError') {
        setSettings([]);
        setError(err.message || 'Unable to load settings.');
      }
    } finally {
      if (isCurrentReload()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    mountedRef.current = true;

    reloadSettings(controller.signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFormError('');
  }

  function resetForm() {
    setForm({ ...DEFAULT_SETTING_FORM });
    setFormError('');
  }

  async function submitSetting(event) {
    event.preventDefault();

    if (actionLoading) {
      return;
    }

    if (!form.setting_key.trim()) {
      setFormError('Setting key is required.');
      return;
    }

    const payload = buildSettingPayload(form);

    if (!payload.ok) {
      setFormError(payload.error);
      return;
    }

    setActionLoading(true);
    setFormError('');

    try {
      const path = form.id ? `/settings/${form.id}` : '/settings';
      await pidFetch(path, {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload.value),
      });
      await reloadSettings();

      if (mountedRef.current) {
        onNotify(form.id ? 'Setting updated.' : 'Setting created.', 'success');
        resetForm();
      }
    } catch (err) {
      if (mountedRef.current) {
        setFormError(err.message || 'Unable to save setting.');
        onNotify(err.message || 'Unable to save setting.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  async function confirmDeleteSetting() {
    if (actionLoading || !deleteSetting?.id) {
      return;
    }

    setActionLoading(true);

    try {
      await pidFetch(`/settings/${deleteSetting.id}`, { method: 'DELETE' });
      await reloadSettings();

      if (mountedRef.current) {
        onNotify('Setting deleted.', 'success');
        setDeleteSetting(null);
        if (form.id === deleteSetting.id) {
          resetForm();
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to delete setting.');
        onNotify(err.message || 'Unable to delete setting.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  const columns = [
    { key: 'setting_key', label: 'Key', render: (setting) => <code>{setting.setting_key}</code> },
    { key: 'scope', label: 'Scope', render: settingScope },
    { key: 'value_type', label: 'Type' },
    { key: 'setting_value', label: 'Value', render: (setting) => <code>{settingValuePreview(setting.setting_value)}</code> },
    {
      key: 'active',
      label: 'State',
      render: (setting) => (
        <span className={`pid-badge pid-badge--${setting.is_active ? 'ok' : 'neutral'}`}>
          {setting.is_active ? 'active' : 'inactive'}
        </span>
      ),
    },
    { key: 'updated_at', label: 'Updated', render: (setting) => formatUpdatedAt(setting.updated_at) },
    {
      key: 'actions',
      label: 'Actions',
      className: 'pid-table__actions',
      render: (setting) => (
        <div className="pid-row-actions">
          <button type="button" className="pid-chip-button" onClick={() => setForm(settingToForm(setting))}>
            Edit
          </button>
          <button type="button" className="pid-chip-button" onClick={() => setDeleteSetting(setting)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="pid-stack">
      {error ? (
        <div className="pid-alert pid-alert--danger" role="alert">
          {error}
        </div>
      ) : null}
      <section className="pid-config-layout" aria-label="Settings management">
        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>{form.id ? 'Edit Setting' : 'Create Setting'}</h2>
            <span>{form.id ? `#${form.id}` : 'Global or client override'}</span>
          </div>
          <form className="pid-config-form" onSubmit={submitSetting}>
            <label>
              <span>Setting key</span>
              <input
                value={form.setting_key}
                onChange={(event) => updateForm('setting_key', event.target.value)}
                placeholder="decision.manual_review_threshold"
              />
            </label>
            <label>
              <span>Client override</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.client_id}
                onChange={(event) => updateForm('client_id', event.target.value)}
                placeholder="Global"
              />
            </label>
            <label>
              <span>Value type</span>
              <select value={form.value_type} onChange={(event) => updateForm('value_type', event.target.value)}>
                {SETTING_VALUE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="pid-config-form__full">
              <span>Setting value</span>
              <textarea
                value={form.setting_value}
                onChange={(event) => updateForm('setting_value', event.target.value)}
                placeholder={form.value_type === 'json' ? '{"enabled":true}' : '60'}
                disabled={form.value_type === 'null'}
              />
            </label>
            <label className="pid-config-form__full">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder="Operational note for this setting"
              />
            </label>
            <label>
              <span>State</span>
              <select
                value={form.is_active ? 'true' : 'false'}
                onChange={(event) => updateForm('is_active', event.target.value === 'true')}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            {formError ? (
              <div className="pid-alert pid-alert--danger" role="alert">
                {formError}
              </div>
            ) : null}
            <div className="pid-form-actions">
              <button type="button" className="pid-chip-button" onClick={resetForm}>
                Reset
              </button>
              <button type="submit" className="pid-chip-button pid-chip-button--accent" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : form.id ? 'Update setting' : 'Create setting'}
              </button>
            </div>
          </form>
        </section>

        <JsonViewer value={previewValue} label="Setting JSON preview" />
      </section>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Settings</h2>
          <span>{loading ? 'Loading' : `${settings.length} rows`}</span>
        </div>
        <DataTable
          ariaLabel="Product image discovery settings"
          columns={columns}
          rows={settings}
          loading={loading}
          emptyTitle="No settings"
          emptyDescription="Seed defaults or create an override to tune the pipeline."
        />
      </section>

      <ConfirmModal
        open={Boolean(deleteSetting)}
        title={deleteSetting ? `Delete ${deleteSetting.setting_key}` : 'Delete setting'}
        description="Delete this setting record. Client overrides fall back to the global/default value after deletion."
        confirmLabel={actionLoading ? 'Working...' : 'Delete'}
        onCancel={() => setDeleteSetting(null)}
        onConfirm={confirmDeleteSetting}
      />
    </div>
  );
}

function booleanSelectOptions() {
  return (
    <>
      <option value="true">Enabled</option>
      <option value="false">Disabled</option>
    </>
  );
}

function secretModeDescription(form, field) {
  const mode = form[`${field}_mode`];
  const hasValue = form[`has_${field}`];

  if (mode === 'replace') {
    return 'A new write-only value will be sent with this save.';
  }

  if (mode === 'clear') {
    return 'The stored value will be cleared on save.';
  }

  return hasValue ? 'Configured value will be kept.' : 'No stored value is configured.';
}

function ProviderSecretControl({ label, field, form, onChange, disabled }) {
  const modeField = `${field}_mode`;

  return (
    <fieldset className="pid-secret-control pid-config-form__full">
      <legend>{label}</legend>
      <label>
        <span>{label} action</span>
        <select
          value={form[modeField]}
          onChange={(event) => onChange(modeField, event.target.value)}
          disabled={disabled}
          aria-label={`${label} action`}
        >
          {PROVIDER_SECRET_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
      </label>
      {form[modeField] === 'replace' ? (
        <label>
          <span>{label} value</span>
          <input
            type="password"
            value={form[field]}
            onChange={(event) => onChange(field, event.target.value)}
            disabled={disabled}
            autoComplete="off"
            aria-label={`${label} value`}
          />
        </label>
      ) : null}
      <p className="pid-muted">{secretModeDescription(form, field)}</p>
    </fieldset>
  );
}

function providerCredentials(provider) {
  return [
    provider.has_api_key ? 'key configured' : 'key missing',
    provider.has_api_secret ? 'secret configured' : 'secret missing',
  ].join(' / ');
}

function providerTestTone(status) {
  switch (status) {
    case 'success':
      return 'ok';
    case 'failed':
      return 'danger';
    case 'empty':
    case 'skipped':
      return 'warn';
    default:
      return 'neutral';
  }
}

function ProviderTestBadge({ result }) {
  if (!result) {
    return <span className="pid-muted">not tested</span>;
  }

  return (
    <span className={`pid-badge pid-badge--${providerTestTone(result.status)}`}>
      {result.status} · {result.latency_ms}ms
    </span>
  );
}

function ConfigStateBadge({ active }) {
  return (
    <span className={`pid-badge pid-badge--${active ? 'ok' : 'neutral'}`}>
      {active ? 'active' : 'inactive'}
    </span>
  );
}

function ProvidersPage({ onNotify }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => ({ ...DEFAULT_PROVIDER_FORM }));
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteProvider, setDeleteProvider] = useState(null);
  const [testingProviderId, setTestingProviderId] = useState(null);
  const [providerTestResults, setProviderTestResults] = useState({});
  const [latestProviderTest, setLatestProviderTest] = useState(null);
  const mountedRef = useRef(true);
  const reloadIdRef = useRef(0);

  const formPayload = useMemo(() => buildProviderPayload(form), [form]);
  const previewValue = useMemo(() => redactProviderPayloadPreview(formPayload), [formPayload]);

  async function reloadProviders(signal) {
    if (!mountedRef.current || signal?.aborted) {
      return;
    }

    const reloadId = reloadIdRef.current + 1;
    reloadIdRef.current = reloadId;
    const isCurrentReload = () => (
      mountedRef.current
      && reloadIdRef.current === reloadId
      && !signal?.aborted
    );

    setLoading(true);
    setError('');

    try {
      const result = await fetchSearchProviders(signal);

      if (!isCurrentReload()) {
        return;
      }

      setProviders(result);
    } catch (err) {
      if (isCurrentReload() && err.name !== 'AbortError') {
        setProviders([]);
        setError(err.message || 'Unable to load providers.');
      }
    } finally {
      if (isCurrentReload()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    mountedRef.current = true;

    reloadProviders(controller.signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFormError('');
  }

  function resetForm() {
    setForm({ ...DEFAULT_PROVIDER_FORM });
    setFormError('');
  }

  async function submitProvider(event) {
    event.preventDefault();

    if (actionLoading) {
      return;
    }

    const payload = buildProviderPayload(form);

    if (!payload.ok) {
      setFormError(payload.error);
      return;
    }

    const savedProviderId = form.id;
    setActionLoading(true);
    setFormError('');

    try {
      const path = form.id ? `/search-providers/${form.id}` : '/search-providers';
      await pidFetch(path, {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload.value),
      });
      await reloadProviders();

      if (mountedRef.current) {
        onNotify(form.id ? 'Provider updated.' : 'Provider created.', 'success');
        if (savedProviderId) {
          setProviderTestResults((current) => {
            const next = { ...current };
            delete next[savedProviderId];

            return next;
          });
          setLatestProviderTest((current) => (
            current?.provider_id === savedProviderId ? null : current
          ));
        }
        resetForm();
      }
    } catch (err) {
      if (mountedRef.current) {
        setFormError(err.message || 'Unable to save provider.');
        onNotify(err.message || 'Unable to save provider.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  async function confirmDeleteProvider() {
    if (actionLoading || !deleteProvider?.id) {
      return;
    }

    setActionLoading(true);

    try {
      await pidFetch(`/search-providers/${deleteProvider.id}`, { method: 'DELETE' });
      await reloadProviders();

      if (mountedRef.current) {
        onNotify('Provider deleted.', 'success');
        setProviderTestResults((current) => {
          const next = { ...current };
          delete next[deleteProvider.id];

          return next;
        });
        setLatestProviderTest((current) => (
          current?.provider_id === deleteProvider.id ? null : current
        ));
        setDeleteProvider(null);
        if (form.id === deleteProvider.id) {
          resetForm();
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to delete provider.');
        onNotify(err.message || 'Unable to delete provider.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  async function testProvider(provider) {
    if (testingProviderId || !provider?.id) {
      return;
    }

    setTestingProviderId(provider.id);
    setLatestProviderTest(null);
    setError('');

    try {
      const payload = await pidFetch(`/search-providers/${provider.id}/test`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'images', limit: 1 }),
      });
      const result = payload?.data ?? payload;

      if (mountedRef.current) {
        setProviderTestResults((current) => ({ ...current, [provider.id]: result }));
        setLatestProviderTest(result);
        onNotify(
          result?.status === 'success' ? 'Provider test succeeded.' : 'Provider test completed.',
          result?.status === 'failed' ? 'danger' : (result?.status === 'success' ? 'success' : 'neutral'),
        );
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to test provider.');
        onNotify(err.message || 'Unable to test provider.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setTestingProviderId(null);
      }
    }
  }

  const columns = [
    { key: 'code', label: 'Code', render: (provider) => <code>{provider.code}</code> },
    { key: 'name', label: 'Name' },
    { key: 'driver', label: 'Driver' },
    { key: 'active', label: 'State', render: (provider) => <ConfigStateBadge active={provider.is_active} /> },
    { key: 'credentials', label: 'Credentials', render: providerCredentials },
    { key: 'last_test', label: 'Last test', render: (provider) => <ProviderTestBadge result={providerTestResults[provider.id]} /> },
    { key: 'priority', label: 'Priority' },
    {
      key: 'limits',
      label: 'Limits',
      render: (provider) => `${provider.timeout_seconds ?? '-'}s / ${provider.rate_limit_per_minute ?? 'no rate'}`,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'pid-table__actions',
      render: (provider) => (
        <div className="pid-row-actions">
          <button
            type="button"
            className="pid-chip-button"
            onClick={() => testProvider(provider)}
            disabled={Boolean(testingProviderId)}
          >
            {testingProviderId === provider.id ? 'Testing...' : 'Test'}
          </button>
          <button type="button" className="pid-chip-button" onClick={() => setForm(providerToForm(provider))}>Edit</button>
          <button type="button" className="pid-chip-button" onClick={() => setDeleteProvider(provider)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="pid-stack">
      <div className="pid-config-layout">
        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>{form.id ? `Edit ${form.code}` : 'Create Provider'}</h2>
            <span>Write-only credentials</span>
          </div>
          <form className="pid-config-form" onSubmit={submitProvider}>
            {formError ? <div className="pid-alert pid-alert--danger">{formError}</div> : null}
            <label>
              <span>Code</span>
              <input value={form.code} onChange={(event) => updateForm('code', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Name</span>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Driver</span>
              <select value={form.driver} onChange={(event) => updateForm('driver', event.target.value)} disabled={actionLoading}>
                {PROVIDER_DRIVERS.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
              </select>
            </label>
            <label>
              <span>State</span>
              <select value={form.is_active} onChange={(event) => updateForm('is_active', event.target.value)} disabled={actionLoading}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label className="pid-config-form__full">
              <span>Base URL</span>
              <input value={form.base_url} onChange={(event) => updateForm('base_url', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Priority</span>
              <input value={form.priority} onChange={(event) => updateForm('priority', event.target.value)} disabled={actionLoading} inputMode="numeric" />
            </label>
            <label>
              <span>Timeout seconds</span>
              <input value={form.timeout_seconds} onChange={(event) => updateForm('timeout_seconds', event.target.value)} disabled={actionLoading} inputMode="numeric" />
            </label>
            <label>
              <span>Rate limit per minute</span>
              <input value={form.rate_limit_per_minute} onChange={(event) => updateForm('rate_limit_per_minute', event.target.value)} disabled={actionLoading} inputMode="numeric" />
            </label>
            <ProviderSecretControl label="API key" field="api_key" form={form} onChange={updateForm} disabled={actionLoading} />
            <ProviderSecretControl label="API secret" field="api_secret" form={form} onChange={updateForm} disabled={actionLoading} />
            <label className="pid-config-form__full">
              <span>Config JSON</span>
              <textarea value={form.config} onChange={(event) => updateForm('config', event.target.value)} disabled={actionLoading} rows={8} />
            </label>
            <div className="pid-form-actions">
              <button type="button" className="pid-chip-button" onClick={resetForm} disabled={actionLoading}>Reset</button>
              <button type="submit" className="pid-chip-button pid-chip-button--accent" disabled={actionLoading}>
                {actionLoading ? 'Working...' : (form.id ? 'Save provider' : 'Create provider')}
              </button>
            </div>
          </form>
        </section>
        <JsonViewer value={previewValue} label="Provider payload preview" />
      </div>

      {error ? <div className="pid-alert pid-alert--danger">{error}</div> : null}

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Search Providers</h2>
          <span>{loading ? 'Loading' : `${providers.length} rows`}</span>
        </div>
        <DataTable
          ariaLabel="Product image discovery search providers"
          columns={columns}
          rows={providers}
          loading={loading}
          emptyTitle="No providers"
          emptyDescription="Create a fake or external search provider before enabling discovery."
        />
      </section>

      {latestProviderTest ? (
        <section className="pid-panel" aria-label="Provider test result">
          <div className="pid-panel__header">
            <h2>Provider Test Result</h2>
            <ProviderTestBadge result={latestProviderTest} />
          </div>
          <div className="pid-test-summary">
            <div>
              <span>Provider</span>
              <strong>{latestProviderTest.code}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>{latestProviderTest.mode}</strong>
            </div>
            <div>
              <span>Results</span>
              <strong>{latestProviderTest.results_count}</strong>
            </div>
            <div>
              <span>Credentials</span>
              <strong>
                {[
                  latestProviderTest.has_api_key ? 'key configured' : 'key missing',
                  latestProviderTest.has_api_secret ? 'secret configured' : 'secret missing',
                ].join(' / ')}
              </strong>
            </div>
            <div className="pid-test-summary__message">
              <span>Message</span>
              <strong>{latestProviderTest.message}</strong>
            </div>
          </div>
          <JsonViewer value={latestProviderTest} label="Provider test details" />
        </section>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteProvider)}
        title={deleteProvider ? `Delete ${deleteProvider.code}` : 'Delete provider'}
        description="Delete this provider configuration. Stored credentials are removed with the provider record."
        confirmLabel={actionLoading ? 'Working...' : 'Delete'}
        onCancel={() => setDeleteProvider(null)}
        onConfirm={confirmDeleteProvider}
      />
    </div>
  );
}

function formatPolicyList(source) {
  const enabled = [
    source.allow_search ? 'search' : null,
    source.allow_scraping ? 'scrape' : null,
    source.allow_download ? 'download' : null,
    source.allow_auto_publish ? 'auto publish' : null,
  ].filter(Boolean);

  return enabled.length > 0 ? enabled.join(', ') : 'none';
}

function formatSourceScope(source) {
  const brands = Array.isArray(source.brand_scope) && source.brand_scope.length > 0
    ? source.brand_scope.join(', ')
    : 'all brands';
  const suppliers = Array.isArray(source.supplier_scope) && source.supplier_scope.length > 0
    ? source.supplier_scope.join(', ')
    : 'all suppliers';

  return `${brands} / ${suppliers}`;
}

function trustedSourceMatchesFilters(source, filters) {
  const clientId = String(source.client_id ?? '');
  const domain = String(source.domain ?? '').toLowerCase();
  const sourceType = String(source.source_type ?? '');

  if (filters.client_id && clientId !== filters.client_id.trim()) {
    return false;
  }

  if (filters.domain && !domain.includes(filters.domain.trim().toLowerCase())) {
    return false;
  }

  if (filters.source_type && sourceType !== filters.source_type) {
    return false;
  }

  for (const field of ['allow_download', 'allow_auto_publish', 'requires_manual_review', 'is_active']) {
    if (filters[field] !== '' && String(Boolean(source[field])) !== filters[field]) {
      return false;
    }
  }

  return true;
}

function TrustedSourcesPage({ onNotify }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => ({ ...DEFAULT_TRUSTED_SOURCE_FORM }));
  const [filters, setFilters] = useState({
    client_id: '',
    domain: '',
    source_type: '',
    allow_download: '',
    allow_auto_publish: '',
    requires_manual_review: '',
    is_active: '',
  });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteSource, setDeleteSource] = useState(null);
  const mountedRef = useRef(true);
  const reloadIdRef = useRef(0);

  const formPayload = useMemo(() => buildTrustedSourcePayload(form), [form]);
  const previewValue = formPayload.ok ? formPayload.value : { error: formPayload.error };
  const filteredSources = useMemo(
    () => sources.filter((source) => trustedSourceMatchesFilters(source, filters)),
    [sources, filters],
  );

  async function reloadSources(signal) {
    if (!mountedRef.current || signal?.aborted) {
      return;
    }

    const reloadId = reloadIdRef.current + 1;
    reloadIdRef.current = reloadId;
    const isCurrentReload = () => (
      mountedRef.current
      && reloadIdRef.current === reloadId
      && !signal?.aborted
    );

    setLoading(true);
    setError('');

    try {
      const result = await fetchTrustedSources(signal);

      if (!isCurrentReload()) {
        return;
      }

      setSources(result);
    } catch (err) {
      if (isCurrentReload() && err.name !== 'AbortError') {
        setSources([]);
        setError(err.message || 'Unable to load trusted sources.');
      }
    } finally {
      if (isCurrentReload()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    mountedRef.current = true;

    reloadSources(controller.signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFormError('');
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm({ ...DEFAULT_TRUSTED_SOURCE_FORM });
    setFormError('');
  }

  async function submitTrustedSource(event) {
    event.preventDefault();

    if (actionLoading) {
      return;
    }

    const payload = buildTrustedSourcePayload(form);

    if (!payload.ok) {
      setFormError(payload.error);
      return;
    }

    setActionLoading(true);
    setFormError('');

    try {
      const path = form.id ? `/trusted-sources/${form.id}` : '/trusted-sources';
      await pidFetch(path, {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload.value),
      });
      await reloadSources();

      if (mountedRef.current) {
        onNotify(form.id ? 'Trusted source updated.' : 'Trusted source created.', 'success');
        resetForm();
      }
    } catch (err) {
      if (mountedRef.current) {
        setFormError(err.message || 'Unable to save trusted source.');
        onNotify(err.message || 'Unable to save trusted source.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  async function confirmDeleteSource() {
    if (actionLoading || !deleteSource?.id) {
      return;
    }

    setActionLoading(true);

    try {
      await pidFetch(`/trusted-sources/${deleteSource.id}`, { method: 'DELETE' });
      await reloadSources();

      if (mountedRef.current) {
        onNotify('Trusted source deleted.', 'success');
        setDeleteSource(null);
        if (form.id === deleteSource.id) {
          resetForm();
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to delete trusted source.');
        onNotify(err.message || 'Unable to delete trusted source.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  const columns = [
    { key: 'trust_score', label: 'Score', render: (source) => <ScorePill score={source.trust_score} /> },
    {
      key: 'domain',
      label: 'Domain',
      render: (source) => (
        <div className="pid-cell-stack">
          <code>{source.domain}</code>
          <span>{source.source_name || source.source_type || 'website'}</span>
        </div>
      ),
    },
    { key: 'policy', label: 'Policy', render: formatPolicyList },
    { key: 'scope', label: 'Scope', render: formatSourceScope },
    { key: 'state', label: 'State', render: (source) => <ConfigStateBadge active={source.is_active} /> },
    {
      key: 'actions',
      label: 'Actions',
      className: 'pid-table__actions',
      render: (source) => (
        <div className="pid-row-actions">
          <button type="button" className="pid-chip-button" onClick={() => setForm(trustedSourceToForm(source))}>Edit</button>
          <button type="button" className="pid-chip-button" onClick={() => setDeleteSource(source)}>Delete</button>
        </div>
      ),
    },
  ];

  const policyFields = [
    ['allow_search', 'Allow search'],
    ['allow_scraping', 'Allow scraping'],
    ['allow_download', 'Allow download'],
    ['allow_auto_publish', 'Allow auto publish'],
    ['allow_description_import', 'Allow description import'],
    ['respect_robots_txt', 'Respect robots.txt'],
    ['requires_manual_review', 'Requires manual review'],
    ['is_active', 'State'],
  ];

  return (
    <div className="pid-stack">
      <div className="pid-config-layout">
        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>{form.id ? `Edit ${form.domain}` : 'Create Trusted Source'}</h2>
            <span>Domain policy</span>
          </div>
          <form className="pid-config-form" onSubmit={submitTrustedSource}>
            {formError ? <div className="pid-alert pid-alert--danger">{formError}</div> : null}
            <label>
              <span>Client override</span>
              <input value={form.client_id} onChange={(event) => updateForm('client_id', event.target.value)} disabled={actionLoading} inputMode="numeric" />
            </label>
            <label>
              <span>Domain</span>
              <input value={form.domain} onChange={(event) => updateForm('domain', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Source name</span>
              <input value={form.source_name} onChange={(event) => updateForm('source_name', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Source type</span>
              <select value={form.source_type} onChange={(event) => updateForm('source_type', event.target.value)} disabled={actionLoading}>
                {TRUSTED_SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="pid-config-form__full">
              <span>Trust score</span>
              <input
                type="range"
                min="0"
                max="100"
                value={form.trust_score}
                onChange={(event) => updateForm('trust_score', event.target.value)}
                disabled={actionLoading}
                aria-label="Trust score slider"
              />
            </label>
            <label>
              <span>Score value</span>
              <input value={form.trust_score} onChange={(event) => updateForm('trust_score', event.target.value)} disabled={actionLoading} inputMode="numeric" aria-label="Trust score" />
            </label>
            <label>
              <span>Rate limit per minute</span>
              <input value={form.rate_limit_per_minute} onChange={(event) => updateForm('rate_limit_per_minute', event.target.value)} disabled={actionLoading} inputMode="numeric" />
            </label>
            <div className="pid-policy-grid pid-config-form__full">
              {policyFields.map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <select value={form[field]} onChange={(event) => updateForm(field, event.target.value)} disabled={actionLoading}>
                    {booleanSelectOptions()}
                  </select>
                </label>
              ))}
            </div>
            <label>
              <span>Brand scope</span>
              <textarea value={form.brand_scope} onChange={(event) => updateForm('brand_scope', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Supplier scope</span>
              <textarea value={form.supplier_scope} onChange={(event) => updateForm('supplier_scope', event.target.value)} disabled={actionLoading} />
            </label>
            <label className="pid-config-form__full">
              <span>URL patterns</span>
              <textarea value={form.url_patterns} onChange={(event) => updateForm('url_patterns', event.target.value)} disabled={actionLoading} />
            </label>
            <label className="pid-config-form__full">
              <span>Permission reference</span>
              <textarea value={form.permission_reference} onChange={(event) => updateForm('permission_reference', event.target.value)} disabled={actionLoading} />
            </label>
            <label className="pid-config-form__full">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} disabled={actionLoading} />
            </label>
            <div className="pid-form-actions">
              <button type="button" className="pid-chip-button" onClick={resetForm} disabled={actionLoading}>Reset</button>
              <button type="submit" className="pid-chip-button pid-chip-button--accent" disabled={actionLoading}>
                {actionLoading ? 'Working...' : (form.id ? 'Save trusted source' : 'Create trusted source')}
              </button>
            </div>
          </form>
        </section>
        <JsonViewer value={previewValue} label="Trusted source payload preview" />
      </div>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Trusted Source Filters</h2>
          <span>{filteredSources.length} visible</span>
        </div>
        <div className="pid-filters">
          <label>
            <span>Client</span>
            <input value={filters.client_id} onChange={(event) => updateFilter('client_id', event.target.value)} inputMode="numeric" />
          </label>
          <label>
            <span>Domain contains</span>
            <input value={filters.domain} onChange={(event) => updateFilter('domain', event.target.value)} />
          </label>
          <label>
            <span>Source type</span>
            <select value={filters.source_type} onChange={(event) => updateFilter('source_type', event.target.value)}>
              <option value="">Any</option>
              {TRUSTED_SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          {[
            ['allow_download', 'Download'],
            ['allow_auto_publish', 'Auto publish'],
            ['requires_manual_review', 'Manual review'],
            ['is_active', 'Active'],
          ].map(([field, label]) => (
            <label key={field}>
              <span>{label}</span>
              <select value={filters[field]} onChange={(event) => updateFilter(field, event.target.value)}>
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          ))}
        </div>
      </section>

      {error ? <div className="pid-alert pid-alert--danger">{error}</div> : null}

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Trusted Sources</h2>
          <span>{loading ? 'Loading' : `${filteredSources.length} of ${sources.length} rows`}</span>
        </div>
        <DataTable
          ariaLabel="Product image discovery trusted sources"
          columns={columns}
          rows={filteredSources}
          loading={loading}
          emptyTitle="No trusted sources"
          emptyDescription="Add domains with explicit policy flags before using trusted-source scoring."
        />
      </section>

      <ConfirmModal
        open={Boolean(deleteSource)}
        title={deleteSource ? `Delete ${deleteSource.domain}` : 'Delete trusted source'}
        description="Delete this trusted-source policy. Existing requests keep their audit trail, but new scoring no longer uses this source."
        confirmLabel={actionLoading ? 'Working...' : 'Delete'}
        onCancel={() => setDeleteSource(null)}
        onConfirm={confirmDeleteSource}
      />
    </div>
  );
}

function debugRunStatusTone(status) {
  if (status === 'succeeded') {
    return 'ok';
  }

  if (status === 'failed') {
    return 'danger';
  }

  if (status === 'running') {
    return 'info';
  }

  return 'neutral';
}

function DebugRunStatusBadge({ status }) {
  return (
    <span className={`pid-badge pid-badge--${debugRunStatusTone(status)}`}>
      {String(status || 'queued').replaceAll('_', ' ')}
    </span>
  );
}

function parseDebugDraft() {
  const fallback = JSON.stringify(DEFAULT_DEBUG_REQUEST, null, 2);

  try {
    return localStorage.getItem(DEBUG_DRAFT_KEY) || fallback;
  } catch (err) {
    void err;

    return fallback;
  }
}

function buildDebugOptions(options) {
  const maxCandidates = parseBoundedInteger(options.max_candidates, 2, 1, 50);
  const goodScore = String(options.good_score ?? '').trim();
  const parsedGoodScore = goodScore === '' ? null : parseBoundedInteger(goodScore, null, 0, 100);

  return {
    max_candidates: maxCandidates,
    fresh: Boolean(options.fresh),
    clean_storage: Boolean(options.clean_storage),
    no_download: Boolean(options.no_download),
    download_all: Boolean(options.download_all),
    stop_on_first_good: Boolean(options.stop_on_first_good),
    exhaustive: Boolean(options.exhaustive),
    good_score: parsedGoodScore,
    no_env_brave: Boolean(options.no_env_brave),
    fail_on_no_match: Boolean(options.fail_on_no_match),
  };
}

function parseBoundedInteger(value, fallback, min, max) {
  const rawValue = String(value ?? '').trim();

  if (!/^-?\d+$/.test(rawValue)) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

const DEBUG_REPORT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'request', label: 'Request' },
  { id: 'search', label: 'Search' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'ai', label: 'AI' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'quality', label: 'Quality' },
  { id: 'events', label: 'Events' },
  { id: 'raw', label: 'Raw JSON' },
];

function debugReportTabLabel(tabId) {
  return DEBUG_REPORT_TABS.find((tab) => tab.id === tabId)?.label ?? 'Report';
}

function parseReportJson(value) {
  const parsed = JSON.parse(value);
  const report = parsed?.data?.report ?? parsed?.report ?? parsed;

  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Report JSON must decode to an object.');
  }

  return report;
}

function formatReportValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function flattenReportValue(value, basePath = '$', options = {}) {
  const maxRows = options.maxRows ?? 80;
  const maxDepth = options.maxDepth ?? 10;
  const query = String(options.query ?? '').trim().toLowerCase();
  const rows = [];
  const stack = [{ value, path: basePath, depth: 0 }];
  const seen = new WeakSet();

  function pushRow(row) {
    if (rows.length >= maxRows) {
      return;
    }

    if (!query || `${row.path} ${formatReportValue(row.value)}`.toLowerCase().includes(query)) {
      rows.push(row);
    }
  }

  while (stack.length > 0 && rows.length < maxRows) {
    const item = stack.pop();

    if (!item) {
      continue;
    }

    if (item.depth > maxDepth) {
      pushRow({ path: item.path, value: '[max depth]' });
      continue;
    }

    if (Array.isArray(item.value)) {
      if (item.value.length === 0) {
        pushRow({ path: item.path, value: [] });
        continue;
      }

      for (let index = item.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: item.value[index], path: `${item.path}[${index}]`, depth: item.depth + 1 });
      }

      continue;
    }

    if (item.value && typeof item.value === 'object') {
      if (seen.has(item.value)) {
        pushRow({ path: item.path, value: '[circular]' });
        continue;
      }

      seen.add(item.value);
      const entries = Object.entries(item.value);

      if (entries.length === 0) {
        pushRow({ path: item.path, value: {} });
        continue;
      }

      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, nestedValue] = entries[index];
        stack.push({ value: nestedValue, path: `${item.path}.${key}`, depth: item.depth + 1 });
      }

      continue;
    }

    pushRow({ path: item.path, value: item.value });
  }

  return rows;
}

function debugCandidateHasMismatch(candidate) {
  return Array.isArray(candidate?.evidence?.mismatches) && candidate.evidence.mismatches.length > 0;
}

function debugCandidateHasAiFailure(candidate) {
  const ai = candidate?.ai_verification;

  if (!ai || typeof ai !== 'object') {
    return false;
  }

  return Boolean(
    ai.error
      || ai.rejection_reason
      || ai.status === 'failed'
      || ai.match === false
      || ai.variant_safe === false
      || ai.image_quality_ok === false
      || ai.brand_match === false
      || ai.model_match === false
      || ai.color_match === false
      || ai.product_type_match === false,
  );
}

function debugCandidateIsDownloaded(candidate, report) {
  const downloadedIds = Array.isArray(report?.downloaded_candidate_ids) ? report.downloaded_candidate_ids : [];

  return Boolean(
    downloadedIds.includes(candidate?.id)
      || candidate?.local_original_path
      || candidate?.local_processed_path
      || ['downloaded', 'quality_passed', 'quality_failed'].includes(candidate?.status),
  );
}

function debugCandidateIsVerified(candidate) {
  return ['verified_match', 'downloaded', 'quality_passed', 'quality_failed'].includes(candidate?.status);
}

function debugCandidateHasQuality(candidate, report) {
  const qualityIds = Array.isArray(report?.quality_candidate_ids) ? report.quality_candidate_ids : [];

  return Boolean(
    qualityIds.includes(candidate?.id)
      || candidate?.quality_analysis
      || (candidate?.scores?.quality_score !== null && candidate?.scores?.quality_score !== undefined),
  );
}

function debugReportCandidateRows(report, filters = {}) {
  const candidates = Array.isArray(report?.candidates) ? report.candidates : [];

  return candidates
    .map((candidate, index) => ({
      ...candidate,
      _row_id: candidate?.id ?? `candidate-${index}`,
      _has_mismatch: debugCandidateHasMismatch(candidate),
      _ai_failure: debugCandidateHasAiFailure(candidate),
      _downloaded: debugCandidateIsDownloaded(candidate, report),
      _verified: debugCandidateIsVerified(candidate),
      _has_quality: debugCandidateHasQuality(candidate, report),
    }))
    .filter((candidate) => !filters.mismatches || candidate._has_mismatch)
    .filter((candidate) => !filters.aiFailures || candidate._ai_failure)
    .filter((candidate) => !filters.downloaded || candidate._downloaded)
    .filter((candidate) => !filters.verified || candidate._verified);
}

function reportSectionValue(report, activeTab, candidateRows) {
  if (!report) {
    return null;
  }

  if (activeTab === 'summary') {
    return { summary: report.summary ?? null, config: report.config ?? null };
  }

  if (activeTab === 'request') {
    return report.request ?? null;
  }

  if (activeTab === 'search') {
    return { search: report.search ?? null, extract: report.extract ?? null };
  }

  if (activeTab === 'candidates') {
    return candidateRows;
  }

  if (activeTab === 'ai') {
    return candidateRows
      .filter((candidate) => candidate.ai_verification || candidate._ai_failure)
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        status: candidate.status,
        ai_verification: candidate.ai_verification ?? null,
        mismatches: candidate.evidence?.mismatches ?? [],
      }));
  }

  if (activeTab === 'downloads') {
    return {
      downloaded_candidate_ids: report.downloaded_candidate_ids ?? [],
      candidates: candidateRows.filter((candidate) => candidate._downloaded),
    };
  }

  if (activeTab === 'quality') {
    return {
      quality_candidate_ids: report.quality_candidate_ids ?? [],
      candidates: candidateRows.filter((candidate) => candidate._has_quality),
    };
  }

  if (activeTab === 'events') {
    return report.events ?? [];
  }

  return report;
}

function DebugReportsPage({ onNotify }) {
  const [mode, setMode] = useState('server');
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [pasteValue, setPasteValue] = useState('');
  const [report, setReport] = useState(null);
  const [reportSource, setReportSource] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    mismatches: false,
    aiFailures: false,
    downloaded: false,
    verified: false,
  });
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();

    async function loadRuns() {
      setLoadingRuns(true);
      setError('');

      try {
        const result = await fetchDebugRuns(controller.signal);

        if (mountedRef.current && !controller.signal.aborted) {
          setRuns(result);
          setSelectedRunId((current) => current || String(result.find((run) => run.report_available)?.id ?? ''));
        }
      } catch (err) {
        if (mountedRef.current && err.name !== 'AbortError') {
          setRuns([]);
          setError(err.message || 'Unable to load debug reports.');
        }
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setLoadingRuns(false);
        }
      }
    }

    loadRuns();

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  const allCandidateRows = useMemo(() => debugReportCandidateRows(report), [report]);
  const candidateRows = useMemo(() => debugReportCandidateRows(report, filters), [report, filters]);
  const activeValue = useMemo(() => reportSectionValue(report, activeTab, candidateRows), [report, activeTab, candidateRows]);
  const searchRows = useMemo(
    () => flattenReportValue(activeValue, '$', { query: searchQuery, maxRows: 80, maxDepth: 10 }),
    [activeValue, searchQuery],
  );

  const runColumns = [
    { key: 'id', label: 'ID', render: (run) => <code>#{run.id}</code>, width: '80px' },
    { key: 'status', label: 'Status', render: (run) => <DebugRunStatusBadge status={run.status} />, width: '130px' },
    { key: 'identity', label: 'Identity', render: (run) => run.request_summary?.erp_model_color_id ?? run.request_payload?.erp_model_color_id ?? '-' },
    { key: 'candidates', label: 'Candidates', render: (run) => run.summary?.candidate_count ?? '-', width: '110px' },
    {
      key: 'actions',
      label: 'Actions',
      className: 'pid-table__actions',
      render: (run) => (
        <button type="button" className="pid-chip-button" onClick={() => loadServerReport(run.id)} disabled={!run.report_available || loadingReport}>
          Open
        </button>
      ),
      width: '110px',
    },
  ];

  const candidateColumns = [
    { key: 'id', label: 'ID', render: (candidate) => <code>{candidate.id ?? '-'}</code>, width: '80px' },
    { key: 'status', label: 'Status', render: (candidate) => <StatusBadge status={candidate.status ?? 'unknown'} />, width: '150px' },
    {
      key: 'title',
      label: 'Candidate',
      render: (candidate) => (
        <div className="pid-cell-stack">
          <strong>{candidate.title ?? '-'}</strong>
          <span>{candidate.source_domain ?? candidate.source_page_url ?? '-'}</span>
        </div>
      ),
    },
    { key: 'score', label: 'Score', render: (candidate) => candidate.scores?.final_score ?? '-', width: '90px' },
    { key: 'mismatches', label: 'Mismatches', render: (candidate) => candidate.evidence?.mismatches?.length ?? 0, width: '110px' },
    { key: 'downloaded', label: 'Downloaded', render: (candidate) => (candidate._downloaded ? 'yes' : 'no'), width: '110px' },
  ];

  const searchColumns = [
    { key: 'path', label: 'Path', render: (row) => <code>{row.path}</code> },
    { key: 'value', label: 'Value', render: (row) => <span className="pid-report-value">{formatReportValue(row.value)}</span> },
    {
      key: 'actions',
      label: 'Copy',
      className: 'pid-table__actions',
      render: (row) => (
        <div className="pid-row-actions">
          <button type="button" className="pid-chip-button" onClick={() => copyReportText(row.path, 'Path copied.')}>Path</button>
          <button type="button" className="pid-chip-button" onClick={() => copyReportText(formatReportValue(row.value), 'Value copied.')}>Value</button>
        </div>
      ),
      width: '150px',
    },
  ];

  function setLoadedReport(nextReport, source) {
    setReport(redactDebugPreview(nextReport));
    setReportSource(source);
    setActiveTab('summary');
    setSearchQuery('');
    setError('');
  }

  async function loadServerReport(runId = selectedRunId) {
    if (!runId) {
      setError('Select a debug run with an available report.');
      return;
    }

    setLoadingReport(true);
    setError('');

    try {
      const result = await fetchDebugRunReport(runId);
      const nextReport = result?.report;

      if (!nextReport) {
        throw new Error('Selected debug run has no report payload.');
      }

      if (mountedRef.current) {
        setSelectedRunId(String(runId));
        setLoadedReport(nextReport, `Debug run #${runId}`);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to load debug report.');
      }
    } finally {
      if (mountedRef.current) {
        setLoadingReport(false);
      }
    }
  }

  function loadPastedReport() {
    try {
      setLoadedReport(parseReportJson(pasteValue), 'Pasted JSON');
      onNotify('Debug report loaded.', 'success');
    } catch (err) {
      setError(err.message || 'Report JSON is invalid.');
      onNotify(err.message || 'Report JSON is invalid.', 'danger');
    }
  }

  function loadUploadedReport(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        setLoadedReport(parseReportJson(String(reader.result ?? '')), file.name);
        onNotify('Debug report loaded.', 'success');
      } catch (err) {
        setError(err.message || 'Report file is invalid.');
        onNotify(err.message || 'Report file is invalid.', 'danger');
      }
    };
    reader.onerror = () => {
      setError('Unable to read report file.');
      onNotify('Unable to read report file.', 'danger');
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function copyReportText(value, message) {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value ?? ''));
      onNotify(message, 'success');
    } catch (err) {
      void err;
    }
  }

  function toggleFilter(name) {
    setFilters((current) => ({ ...current, [name]: !current[name] }));
  }

  return (
    <div className="pid-stack">
      {error ? <div className="pid-alert pid-alert--danger" role="alert">{error}</div> : null}

      <div className="pid-config-layout">
        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>Load Debug Report</h2>
            <span>{loadingRuns ? 'Loading' : `${runs.filter((run) => run.report_available).length} available`}</span>
          </div>
          <div className="pid-report-source">
            <div className="pid-segmented" aria-label="Report source">
              {[
                ['server', 'Server'],
                ['paste', 'Paste'],
                ['upload', 'Upload'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={mode === id ? 'pid-segmented__item pid-segmented__item--active' : 'pid-segmented__item'}
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'server' ? (
              <>
                <label>
                  <span>Debug run</span>
                  <select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)} disabled={loadingRuns || loadingReport}>
                    <option value="">Select report</option>
                    {runs.filter((run) => run.report_available).map((run) => (
                      <option key={run.id} value={run.id}>
                        #{run.id} - {run.request_summary?.erp_model_color_id ?? run.request_payload?.erp_model_color_id ?? run.status}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="pid-chip-button pid-chip-button--accent" onClick={() => loadServerReport()} disabled={!selectedRunId || loadingReport}>
                  {loadingReport ? 'Loading...' : 'Open report'}
                </button>
              </>
            ) : null}

            {mode === 'paste' ? (
              <>
                <label>
                  <span>Report JSON</span>
                  <textarea value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} rows={12} />
                </label>
                <button type="button" className="pid-chip-button pid-chip-button--accent" onClick={loadPastedReport} disabled={!pasteValue.trim()}>
                  Load pasted report
                </button>
              </>
            ) : null}

            {mode === 'upload' ? (
              <label>
                <span>Report file</span>
                <input type="file" accept=".json,application/json" onChange={loadUploadedReport} />
              </label>
            ) : null}
          </div>
        </section>

        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>Recent Server Reports</h2>
            <span>{runs.length} runs</span>
          </div>
          <DataTable
            ariaLabel="Stored debug reports"
            columns={runColumns}
            rows={runs.filter((run) => run.report_available)}
            loading={loadingRuns}
            emptyTitle="No stored reports"
            emptyDescription="Run Debug Flow to create the first stored report."
          />
        </section>
      </div>

      {!report ? (
        <section className="pid-panel">
          <EmptyState title="No report selected" description="Choose a server, pasted, or uploaded report." />
        </section>
      ) : (
        <>
          <section className="pid-panel" aria-label="Debug report summary">
            <div className="pid-panel__header">
              <h2>{reportSource || 'Debug report'}</h2>
              <span>{report.summary?.completed_at ?? report.summary?.started_at ?? 'loaded'}</span>
            </div>
            <div className="pid-kpis">
              <div className="pid-kpi pid-kpi--compact">
                <span>Status</span>
                <strong>{report.request?.status ?? '-'}</strong>
              </div>
              <div className="pid-kpi pid-kpi--compact">
                <span>Final score</span>
                <strong>{report.request?.final_score ?? '-'}</strong>
              </div>
              <div className="pid-kpi pid-kpi--compact">
                <span>Candidates</span>
                <strong>{report.summary?.candidate_count ?? allCandidateRows.length}</strong>
              </div>
              <div className="pid-kpi pid-kpi--compact">
                <span>Verified</span>
                <strong>{report.summary?.verified_match_count ?? allCandidateRows.filter((candidate) => candidate._verified).length}</strong>
              </div>
              <div className="pid-kpi pid-kpi--compact">
                <span>Provider</span>
                <strong className="pid-metric__text">{report.search?.provider ?? '-'}</strong>
              </div>
            </div>
          </section>

          <section className="pid-panel" aria-label="Debug report inspector">
            <div className="pid-panel__header">
              <h2>Report Inspector</h2>
              <span>{debugReportTabLabel(activeTab)}</span>
            </div>
            <div className="pid-report-toolbar">
              <div className="pid-tabs" aria-label="Debug report sections">
                {DEBUG_REPORT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? 'pid-tabs__item pid-tabs__item--active' : 'pid-tabs__item'}
                    aria-pressed={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <label className="pid-report-search">
                <span>Search JSON</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="path or value" />
              </label>
              <div className="pid-report-filters" aria-label="Candidate filters">
                {[
                  ['mismatches', 'Only mismatches'],
                  ['aiFailures', 'Only AI failures'],
                  ['downloaded', 'Only downloaded'],
                  ['verified', 'Only verified'],
                ].map(([id, label]) => (
                  <label key={id}>
                    <input type="checkbox" checked={filters[id]} onChange={() => toggleFilter(id)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {activeTab === 'candidates' ? (
              <DataTable
                ariaLabel="Debug report candidates"
                columns={candidateColumns}
                rows={candidateRows}
                rowKey="_row_id"
                emptyTitle="No candidates"
                emptyDescription="No candidates match the active report filters."
              />
            ) : null}

            <JsonViewer value={activeValue} label={`${debugReportTabLabel(activeTab)} JSON`} />

            <div className="pid-panel pid-panel--flat">
              <div className="pid-panel__header">
                <h2>JSON Matches</h2>
                <span>{searchRows.length} rows</span>
              </div>
              <DataTable
                ariaLabel="Debug report JSON matches"
                columns={searchColumns}
                rows={searchRows}
                rowKey="path"
                emptyTitle="No JSON matches"
                emptyDescription="No paths match the current search."
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DebugFlowPage({ onNotify }) {
  const [requestJson, setRequestJson] = useState(parseDebugDraft);
  const [options, setOptions] = useState(() => ({ ...DEFAULT_DEBUG_OPTIONS }));
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  async function reloadRuns(signal) {
    setLoading(true);
    setError('');

    try {
      const result = await fetchDebugRuns(signal);

      if (mountedRef.current && !signal?.aborted) {
        setRuns(result);
      }
    } catch (err) {
      if (mountedRef.current && err.name !== 'AbortError') {
        setError(err.message || 'Unable to load debug runs.');
        setRuns([]);
      }
    } finally {
      if (mountedRef.current && !signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    mountedRef.current = true;
    reloadRuns(controller.signal);

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let parsed;

    try {
      parsed = JSON.parse(requestJson);
    } catch (err) {
      void err;

      try {
        localStorage.removeItem(DEBUG_DRAFT_KEY);
      } catch (storageErr) {
        void storageErr;
      }

      return;
    }

    try {
      localStorage.setItem(DEBUG_DRAFT_KEY, JSON.stringify(redactDebugPreview(parsed), null, 2));
    } catch (err) {
      void err;
    }
  }, [requestJson]);

  useEffect(() => {
    if (!selectedRun?.id || !['queued', 'running'].includes(selectedRun.status)) {
      return undefined;
    }

    const debugRunId = selectedRun.id;
    let cancelled = false;
    let timeoutId;
    let controller = null;

    const schedulePoll = () => {
      timeoutId = window.setTimeout(poll, 1500);
    };

    const poll = async () => {
      controller = new AbortController();

      try {
        const result = await fetchDebugRun(debugRunId, controller.signal);

        if (!cancelled && mountedRef.current) {
          setSelectedRun(result);
          setRuns((current) => current.map((run) => (run.id === result.id ? result : run)));
        }
      } catch (err) {
        if (!cancelled && mountedRef.current && err.name !== 'AbortError') {
          setError(err.message || 'Unable to poll debug run.');
        }
      } finally {
        controller = null;

        if (!cancelled && mountedRef.current) {
          schedulePoll();
        }
      }
    };

    schedulePoll();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [selectedRun?.id, selectedRun?.status]);

  function updateOption(name, value) {
    setOptions((current) => ({ ...current, [name]: value }));
    setError('');
  }

  async function submitDebugRun(event) {
    event.preventDefault();

    if (actionLoading) {
      return;
    }

    let requestPayload;

    try {
      requestPayload = JSON.parse(requestJson);
    } catch (err) {
      setError(`Request JSON is invalid: ${err.message}`);
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const run = await createDebugRun({
        request_payload: requestPayload,
        options: buildDebugOptions(options),
      });

      if (mountedRef.current) {
        setSelectedRun(run);
        setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)].slice(0, 20));
        onNotify(debugRunNotificationMessage(run.status), run.status === 'failed' ? 'danger' : 'success');
        await reloadRuns();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to create debug run.');
        onNotify(err.message || 'Unable to create debug run.', 'danger');
      }
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  function debugRunNotificationMessage(status) {
    if (status === 'failed') {
      return 'Debug run failed.';
    }

    if (status === 'succeeded') {
      return 'Debug run completed.';
    }

    return 'Debug run started.';
  }

  async function openDebugRun(run) {
    setSelectedRun(run);
    setError('');

    const hasHydratedReport = run?.report != null;

    if (!run?.id || hasHydratedReport) {
      return;
    }

    try {
      const result = await fetchDebugRun(run.id);

      if (mountedRef.current) {
        setSelectedRun(result);
        setRuns((current) => current.map((item) => (item.id === result.id ? result : item)));
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to load debug run report.');
      }
    }
  }

  const columns = [
    { key: 'id', label: 'ID', render: (run) => <code>#{run.id}</code> },
    { key: 'status', label: 'Status', render: (run) => <DebugRunStatusBadge status={run.status} /> },
    { key: 'identity', label: 'Identity', render: (run) => run.request_summary?.erp_model_color_id ?? run.request_payload?.erp_model_color_id ?? '-' },
    { key: 'score', label: 'Score', render: (run) => run.request_summary?.final_score ?? '-' },
    { key: 'candidates', label: 'Candidates', render: (run) => run.summary?.candidate_count ?? '-' },
    { key: 'updated_at', label: 'Updated', render: (run) => formatUpdatedAt(run.updated_at) },
    {
      key: 'actions',
      label: 'Actions',
      className: 'pid-table__actions',
      render: (run) => (
        <button type="button" className="pid-chip-button" onClick={() => openDebugRun(run)}>
          Open
        </button>
      ),
    },
  ];

  return (
    <div className="pid-stack">
      {error ? <div className="pid-alert pid-alert--danger" role="alert">{error}</div> : null}
      <div className="pid-config-layout">
        <section className="pid-panel">
          <div className="pid-panel__header">
            <h2>Run Debug Flow</h2>
            <span>Command-backed</span>
          </div>
          <form className="pid-config-form" onSubmit={submitDebugRun}>
            <label className="pid-config-form__full">
              <span>Request JSON</span>
              <textarea value={requestJson} onChange={(event) => setRequestJson(event.target.value)} rows={14} disabled={actionLoading} />
            </label>
            <label>
              <span>Max candidates</span>
              <input value={options.max_candidates} inputMode="numeric" onChange={(event) => updateOption('max_candidates', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Good score</span>
              <input value={options.good_score} inputMode="numeric" placeholder="config default" onChange={(event) => updateOption('good_score', event.target.value)} disabled={actionLoading} />
            </label>
            <label>
              <span>Fresh request</span>
              <select value={String(options.fresh)} onChange={(event) => updateOption('fresh', event.target.value === 'true')} disabled={actionLoading}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label>
              <span>No download</span>
              <select value={String(options.no_download)} onChange={(event) => updateOption('no_download', event.target.value === 'true')} disabled={actionLoading}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label>
              <span>Clean storage</span>
              <select value={String(options.clean_storage)} onChange={(event) => updateOption('clean_storage', event.target.value === 'true')} disabled={actionLoading}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label>
              <span>Download all</span>
              <select value={String(options.download_all)} onChange={(event) => updateOption('download_all', event.target.value === 'true')} disabled={actionLoading || options.no_download}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label>
              <span>Stop on first good</span>
              <select value={String(options.stop_on_first_good)} onChange={(event) => updateOption('stop_on_first_good', event.target.value === 'true')} disabled={actionLoading || options.exhaustive}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label>
              <span>Exhaustive</span>
              <select value={String(options.exhaustive)} onChange={(event) => updateOption('exhaustive', event.target.value === 'true')} disabled={actionLoading}>
                {booleanSelectOptions()}
              </select>
            </label>
            <label>
              <span>No env Brave</span>
              <select value={String(options.no_env_brave)} onChange={(event) => updateOption('no_env_brave', event.target.value === 'true')} disabled={actionLoading}>
                {booleanSelectOptions()}
              </select>
            </label>
            <div className="pid-form-actions">
              <button type="button" className="pid-chip-button" onClick={() => setRequestJson(JSON.stringify(DEFAULT_DEBUG_REQUEST, null, 2))} disabled={actionLoading}>
                Reset JSON
              </button>
              <button type="submit" className="pid-chip-button pid-chip-button--accent" disabled={actionLoading}>
                {actionLoading ? 'Running...' : 'Run debug flow'}
              </button>
            </div>
          </form>
        </section>
        <JsonViewer value={{ request_payload: redactDebugPreview(safeJsonPreview(requestJson)), options: buildDebugOptions(options) }} label="Debug payload preview" />
      </div>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Debug Runs</h2>
          <span>{loading ? 'Loading' : `${runs.length} recent`}</span>
        </div>
        <DataTable
          ariaLabel="Product image discovery debug runs"
          columns={columns}
          rows={runs}
          loading={loading}
          emptyTitle="No debug runs"
          emptyDescription="Run a debug flow to create a report."
        />
      </section>

      {selectedRun ? (
        <section className="pid-panel" aria-label="Debug run result">
          <div className="pid-panel__header">
            <h2>Debug Run #{selectedRun.id}</h2>
            <DebugRunStatusBadge status={selectedRun.status} />
          </div>
          {selectedRun.error_message ? <div className="pid-alert pid-alert--danger">{selectedRun.error_message}</div> : null}
          <div className="pid-detail-summary">
            <div>
              <span>ERP color</span>
              <strong>{selectedRun.request_summary?.erp_model_color_id ?? selectedRun.request_payload?.erp_model_color_id ?? '-'}</strong>
            </div>
            <div>
              <span>Candidates</span>
              <strong>{selectedRun.summary?.candidate_count ?? '-'}</strong>
            </div>
            <div>
              <span>Checked</span>
              <strong>{selectedRun.summary?.candidates_checked ?? '-'}</strong>
            </div>
            <div>
              <span>Exit</span>
              <strong>{selectedRun.exit_code ?? '-'}</strong>
            </div>
          </div>
          <JsonViewer value={redactDebugPreview(selectedRun.report ?? selectedRun)} label="Debug run report" />
        </section>
      ) : null}
    </div>
  );
}

function safeJsonPreview(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return { error: err.message };
  }
}

function redactDebugPreview(value) {
  if (Array.isArray(value)) {
    return value.map(redactDebugPreview);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        !/^has_(api[_-]?key|api[_-]?secret)$/i.test(key)
          && /(api[_-]?key|api[_-]?secret|authorization|credential|password|secret|token)/i.test(key)
          ? (item ? '[redacted]' : item)
          : redactDebugPreview(item),
      ]),
    );
  }

  return value;
}

function HealthStatusBadge({ configured, configuredLabel = 'configured', missingLabel = 'missing' }) {
  return (
    <span className={`pid-badge pid-badge--${configured ? 'ok' : 'danger'}`}>
      {configured ? configuredLabel : missingLabel}
    </span>
  );
}

function HealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function loadHealth() {
      setLoading(true);
      setError('');

      try {
        const result = await fetchHealth(controller.signal);

        if (mounted) {
          setHealth(result);
        }
      } catch (err) {
        if (mounted && err.name !== 'AbortError') {
          setHealth(null);
          setError(err.message || 'Unable to load health.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadHealth();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  if (loading) {
    return <LoadingState label="Runtime Health" />;
  }

  const envRows = health?.env_status ?? [];
  const aiProviders = health?.ai?.providers ?? [];
  const queueRows = health?.queue?.queues ?? [];
  const providerRows = health?.providers ?? [];
  const activeProviderCount = providerRows.filter((provider) => provider.active).length;

  const envColumns = [
    { key: 'key', label: 'Key', render: (row) => <code>{row.key}</code> },
    { key: 'scope', label: 'Scope' },
    { key: 'configured', label: 'Status', render: (row) => <HealthStatusBadge configured={row.configured} /> },
  ];
  const aiColumns = [
    { key: 'provider', label: 'Provider' },
    { key: 'api_key_configured', label: 'API key', render: (row) => <HealthStatusBadge configured={row.api_key_configured} /> },
    {
      key: 'base_url_configured',
      label: 'Base URL',
      render: (row) => (
        <span className={`pid-badge pid-badge--${row.base_url_configured ? 'ok' : 'neutral'}`}>
          {row.base_url_configured ? 'set' : 'default'}
        </span>
      ),
    },
  ];
  const queueColumns = [
    { key: 'phase', label: 'Phase' },
    { key: 'queue', label: 'Queue' },
    { key: 'status', label: 'Status', render: (row) => <span className="pid-badge pid-badge--ok">{row.status}</span> },
  ];
  const providerColumns = [
    { key: 'code', label: 'Code', render: (provider) => <code>{provider.code}</code> },
    { key: 'driver', label: 'Driver' },
    { key: 'active', label: 'State', render: (provider) => <ConfigStateBadge active={provider.active} /> },
    { key: 'credentials', label: 'Credentials', render: (provider) => providerCredentials({ has_api_key: provider.has_api_key, has_api_secret: provider.has_api_secret }) },
    {
      key: 'limits',
      label: 'Limits',
      render: (provider) => {
        const timeoutLabel = provider.timeout_seconds == null ? '-' : `${provider.timeout_seconds}s`;

        return `${timeoutLabel} / ${provider.rate_limit_per_minute ?? 'no rate'}`;
      },
    },
  ];

  return (
    <div className="pid-stack">
      {error ? <div className="pid-alert pid-alert--danger" role="alert">{error}</div> : null}
      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Runtime Health</h2>
          <span>{health?.app?.environment ?? 'unknown'}</span>
        </div>
        <div className="pid-metric-grid">
          <div className="pid-metric">
            <span>Package API</span>
            <strong className="pid-metric__text">{health?.app?.package_api_prefix ?? '-'}</strong>
          </div>
          <div className="pid-metric">
            <span>Storage</span>
            <strong className="pid-metric__text">{health?.storage?.disk ?? '-'}</strong>
            <HealthStatusBadge configured={Boolean(health?.storage?.configured)} />
          </div>
          <div className="pid-metric">
            <span>Queue</span>
            <strong className="pid-metric__text">{health?.queue?.connection ?? '-'}</strong>
            <span>{queueRows.length} queues</span>
          </div>
          <div className="pid-metric">
            <span>Providers</span>
            <strong>{activeProviderCount}/{providerRows.length}</strong>
            <span>active</span>
          </div>
        </div>
      </section>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>AI Configuration</h2>
          <HealthStatusBadge configured={Boolean(health?.ai?.enabled)} configuredLabel="enabled" missingLabel="disabled" />
        </div>
        <div className="pid-detail-summary">
          <div>
            <span>Provider</span>
            <strong>{health?.ai?.provider ?? '-'}</strong>
          </div>
          <div>
            <span>Provider key</span>
            <HealthStatusBadge configured={Boolean(health?.ai?.provider_key_configured)} />
          </div>
          <div>
            <span>Vision model</span>
            <HealthStatusBadge configured={Boolean(health?.ai?.vision_model_configured)} />
          </div>
          <div>
            <span>Remote image</span>
            <HealthStatusBadge configured={Boolean(health?.ai?.attach_remote_image)} configuredLabel="enabled" missingLabel="disabled" />
          </div>
        </div>
        <DataTable
          ariaLabel="AI provider credential status"
          columns={aiColumns}
          rows={aiProviders}
          rowKey="provider"
          emptyTitle="No AI providers"
          emptyDescription="AI provider config is empty."
        />
      </section>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Environment Keys</h2>
          <span>{envRows.filter((row) => row.configured).length}/{envRows.length} configured</span>
        </div>
        <DataTable
          ariaLabel="Environment key status"
          columns={envColumns}
          rows={envRows}
          rowKey="key"
          emptyTitle="No environment keys"
          emptyDescription="No expected keys were reported."
        />
      </section>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Provider Health</h2>
          <span>{providerRows.length} providers</span>
        </div>
        <DataTable
          ariaLabel="Search provider health status"
          columns={providerColumns}
          rows={providerRows}
          rowKey="id"
          emptyTitle="No providers"
          emptyDescription="No search providers are configured."
        />
      </section>

      <section className="pid-panel">
        <div className="pid-panel__header">
          <h2>Queues</h2>
          <span>{health?.queue?.connection ?? '-'}</span>
        </div>
        <DataTable
          ariaLabel="Product image discovery queue status"
          columns={queueColumns}
          rows={queueRows}
          rowKey="phase"
          emptyTitle="No queues"
          emptyDescription="No package queues are configured."
        />
      </section>
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
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));
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
  const detailLoadId = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pid-admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    const pagePath = pathForPage(page);

    if (page !== 'requests' && page !== 'review') {
      window.history.replaceState({}, '', `${pagePath}${window.location.hash}`);
      return;
    }

    const params = requestFiltersToSearchParams(
      page === 'review' ? { ...requestFilters, manual_review_required: 'true' } : requestFilters,
    );
    const query = params.toString();
    const nextUrl = `${pagePath}${query ? `?${query}` : ''}${window.location.hash}`;
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
    if (page !== 'requests' && page !== 'review') {
      setRequestLoading(false);
      return undefined;
    }

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
  }, [page, effectiveRequestFilters]);

  async function openRequest(request) {
    const loadId = detailLoadId.current + 1;
    detailLoadId.current = loadId;

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

      if (detailLoadId.current !== loadId) {
        return;
      }

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
      if (detailLoadId.current === loadId) {
        setDetailError(err.message || 'Unable to load request detail.');
      }
    } finally {
      if (detailLoadId.current === loadId) {
        setDetailLoading(false);
      }
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
    detailLoadId.current += 1;
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

  let body;

  if (page === 'overview') {
    body = <Overview summary={summary} requests={overviewRequests} loading={loading} error={error} />;
  } else if (page === 'requests') {
    body = (
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
  } else if (page === 'review') {
    body = (
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
  } else if (page === 'settings') {
    body = <SettingsPage onNotify={notify} />;
  } else if (page === 'providers') {
    body = <ProvidersPage onNotify={notify} />;
  } else if (page === 'trusted') {
    body = <TrustedSourcesPage onNotify={notify} />;
  } else if (page === 'health') {
    body = <HealthPage />;
  } else if (page === 'debug') {
    body = <DebugFlowPage onNotify={notify} />;
  } else if (page === 'reports') {
    body = <DebugReportsPage onNotify={notify} />;
  } else {
    body = <PlaceholderPage page={currentPage} />;
  }

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
