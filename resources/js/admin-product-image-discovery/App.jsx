import React, { useEffect, useMemo, useState } from 'react';
import { pidFetch, normalizeLaravelPagination, buildRequestSearchPath } from './api';
import { DataTable } from './components/DataTable';
import { Drawer } from './components/Drawer';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { JsonViewer } from './components/JsonViewer';
import { ScorePill } from './components/ScorePill';
import { StatusBadge } from './components/StatusBadge';
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
          <span>Source domain</span>
          <input value={filters.source_domain} onChange={(event) => update('source_domain', event.target.value)} placeholder="cdn.example.com" />
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
      </div>
      <div className="pid-filter-actions">
        <FilterBar label="Active filters" filters={activeChips} onClear={onReset} />
      </div>
    </section>
  );
}

function RequestDetailDrawer({ open, detail, events, candidates, loading, error, onClose }) {
  const detailSummary = buildDetailSummary(detail);
  const selectedCandidate = detail?.selected_candidate ?? null;
  const bestCandidate = detail?.best_candidate ?? null;

  return (
    <Drawer open={open} title={detail ? `Request ${detail.id}` : 'Request detail'} onClose={onClose}>
      {loading ? <EmptyState title="Loading request detail" description="Fetching request, candidates, and events." /> : null}
      {error ? <div className="pid-alert pid-alert--danger" role="alert">{error}</div> : null}
      {!loading && detail ? (
        <div className="pid-detail-grid">
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
                  <div>
                    <strong>{candidate.source_domain}</strong>
                    <span>{candidate.source_page_url}</span>
                  </div>
                  <ScorePill score={candidate.final_score} />
                  <StatusBadge status={candidate.id === selectedCandidate?.id ? 'published' : candidate.id === bestCandidate?.id ? 'ready_to_publish' : candidate.status} />
                </div>
              ))}
            </div>
          </section>

          <section className="pid-panel pid-panel--flat">
            <div className="pid-panel__header">
              <h2>Events</h2>
              <span>{events.length} items</span>
            </div>
            <div className="pid-detail-events">
              {events.length === 0 ? (
                <EmptyState title="No events" description="The selected request has no events yet." />
              ) : (
                <ul className="pid-timeline">
                  {events.map((event) => (
                    <li key={event.id} className="pid-timeline__item">
                      <strong>{event.event_type}</strong>
                      <span>{event.message}</span>
                      <span className="pid-muted">{formatUpdatedAt(event.created_at)}</span>
                    </li>
                  ))}
                </ul>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pid-admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    const params = requestFiltersToSearchParams(requestFilters);
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [requestFilters]);

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

      const effectiveFilters = page === 'review'
        ? { ...requestFilters, manual_review_required: 'true' }
        : requestFilters;

      try {
        const result = await pidFetch(buildRequestSearchPath(effectiveFilters), { signal: controller.signal });

        if (!cancelled) {
          setRequestRows(normalizeLaravelPagination(result).data);
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
  }, [page, requestFilters]);

  async function openRequest(request) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailRequest(null);
    setDetailCandidates([]);
    setDetailEvents([]);

    try {
      const [detailResult, eventsResult] = await Promise.all([
        pidFetch(`/requests/${request.id}`),
        pidFetch(`/requests/${request.id}/events`),
      ]);

      setDetailRequest(detailResult.data ?? detailResult);
      setDetailCandidates(detailResult.candidates ?? []);
      setDetailEvents(normalizeLaravelPagination(eventsResult).data);
    } catch (err) {
      setDetailError(err.message || 'Unable to load request detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  function clearFilters() {
    setRequestFilters(createDefaultRequestFilters());
  }

  const currentPage = pageIndex[page] ?? pageIndex.overview;
  const activeRequestFilters = useMemo(() => requestFiltersToActiveChips(requestFilters), [requestFilters]);

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
          filters={requestFilters}
          onFiltersChange={setRequestFilters}
          activeChips={activeRequestFilters}
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
            onClose: () => {
              setDetailOpen(false);
              setDetailRequest(null);
              setDetailCandidates([]);
              setDetailEvents([]);
              setDetailError('');
            },
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
          filters={{ ...requestFilters, manual_review_required: 'true' }}
          onFiltersChange={(next) => setRequestFilters({ ...next, manual_review_required: next.manual_review_required || 'true' })}
          activeChips={requestFiltersToActiveChips({ ...requestFilters, manual_review_required: 'true' })}
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
            onClose: () => {
              setDetailOpen(false);
              setDetailRequest(null);
              setDetailCandidates([]);
              setDetailEvents([]);
              setDetailError('');
            },
          }}
          manualReviewOnly
        />
      );
    }

    return <PlaceholderPage page={currentPage} />;
  }, [activeRequestFilters, clearFilters, currentPage, detailCandidates, detailError, detailEvents, detailLoading, detailRequest, error, loading, openRequest, page, requestFilters, requestLoading, requestRows, summary, overviewRequests]);

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
    </div>
  );
}
