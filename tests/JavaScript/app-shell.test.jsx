import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../resources/js/admin-product-image-discovery/App';
import { ImageTile } from '../../resources/js/admin-product-image-discovery/components/ImageTile';
import { JsonViewer } from '../../resources/js/admin-product-image-discovery/components/JsonViewer';

function mockJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: vi.fn().mockResolvedValue(payload),
    text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

function deferredJsonResponse(payload) {
  let resolve;
  const promise = new Promise((done) => {
    resolve = () => done(mockJsonResponse(payload));
  });

  return { promise, resolve };
}

describe('admin product image discovery shell', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => {
        store.set(key, String(value));
      }),
      clear: vi.fn(() => {
        store.clear();
      }),
      removeItem: vi.fn((key) => {
        store.delete(key);
      }),
    });
    document.documentElement.dataset.theme = 'light';
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">';
    window.PID_ADMIN = { apiBase: '/admin/product-image-discovery' };
    window.history.replaceState({}, '', '/admin/product-image-discovery/');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.PID_ADMIN;
  });

  it('renders the shell, exposes accessible navigation labels, and toggles theme', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          counts: {
            total: 12,
            manual_review: 2,
            ready_to_publish: 5,
            failed: 1,
            no_candidates_found: 3,
          },
          provider_status: [
            { code: 'serpapi', driver: 'serpapi', active: true, has_api_key: true },
          ],
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            {
              id: 11,
              status: 'manual_review',
              final_score: 67,
              brand: 'Acme',
              supplier: 'Primary',
              erp_model_color_id: 'ERP-11',
              updated_at: '2026-04-30T09:30:00Z',
            },
          ],
        }),
      );

    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    render(<App />);

    expect(await screen.findByRole('navigation', { name: 'Product image discovery sections' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Overview section' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(screen.getByText('Provider Health')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 280);
    expect(window.location.pathname).toBe('/admin/product-image-discovery');
  });

  it('keeps the shell mounted when API calls fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('summary failed'))
        .mockRejectedValueOnce(new Error('requests failed')),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard summary is unavailable.');
    expect(screen.getByText('Queue Snapshot')).toBeVisible();
  });

  it('loads request filters from the url and shows the filter bar', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/requests?brand=Herno');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          mockJsonResponse({
            counts: { total: 1, manual_review: 1, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
            provider_status: [],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 44,
                status: 'manual_review',
                final_score: 61,
                brand: 'Herno',
                supplier: 'Herno',
                erp_model_color_id: 'HERO-001-BLK',
                updated_at: '2026-04-30T09:30:00Z',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 44,
                status: 'manual_review',
                final_score: 61,
                brand: 'Herno',
                supplier: 'Herno',
                erp_model_color_id: 'HERO-001-BLK',
                updated_at: '2026-04-30T09:30:00Z',
              },
            ],
          }),
        ),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Search Filters' })).toBeVisible();
    expect(screen.getByLabelText('Brand')).toHaveValue('Herno');
    expect(screen.getByLabelText('Client')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Client')).toHaveAttribute('min', '1');
    expect(screen.getByLabelText('Rejection reason')).toHaveAttribute('placeholder', 'WRONG_COLOR');
    expect(screen.getByLabelText('Created from')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeVisible();
  });

  it('pins manual review filtering and shows the review banner on the review page', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/review?brand=Herno');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          mockJsonResponse({
            counts: { total: 1, manual_review: 1, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
            provider_status: [],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 55,
                status: 'manual_review',
                final_score: 64,
                brand: 'Herno',
                supplier: 'Herno',
                erp_model_color_id: 'HERO-002-BLK',
                updated_at: '2026-04-30T10:00:00Z',
              },
            ],
          }),
        ),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Manual Review Queue' })).toBeVisible();
    expect(screen.getByText('Manual review is pinned on this view.')).toBeVisible();
    expect(screen.getByLabelText('Manual review only')).toHaveValue('true');
    expect(screen.getByLabelText('Manual review only')).toBeDisabled();

    await waitFor(() => expect(window.location.search).toContain('manual_review_required=true'));
  });

  it('loads settings and submits typed setting payloads from the configuration page', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/settings');
    let createdPayload = null;
    const settingsPayload = {
      data: [
        {
          id: 7,
          client_id: null,
          setting_key: 'decision.manual_review_threshold',
          setting_value: 55,
          value_type: 'integer',
          description: 'Manual review threshold',
          is_active: true,
          updated_at: '2026-05-01T10:00:00Z',
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/settings') && method === 'POST') {
        createdPayload = JSON.parse(options.body);
        return Promise.resolve(mockJsonResponse({ data: { id: 8, ...createdPayload } }));
      }

      if (path.endsWith('/settings')) {
        return Promise.resolve(mockJsonResponse(settingsPayload));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Create Setting' })).toBeVisible();
    expect(await screen.findByText('decision.manual_review_threshold')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Setting JSON preview' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Setting key'), { target: { value: 'decision.auto_publish_threshold' } });
    fireEvent.change(screen.getByLabelText('Client override'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Setting value'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Client threshold' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create setting' }));

    await waitFor(() => expect(createdPayload).toEqual({
      client_id: 5,
      setting_key: 'decision.auto_publish_threshold',
      setting_value: 88,
      value_type: 'integer',
      description: 'Client threshold',
      is_active: false,
    }));
  });

  it('does not notify from settings reloads after leaving the page', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/settings');
    const delayedReload = deferredJsonResponse({ data: [] });
    let settingsReads = 0;

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/settings') && method === 'POST') {
        return Promise.resolve(mockJsonResponse({ data: { id: 8 } }));
      }

      if (path.endsWith('/settings')) {
        settingsReads += 1;

        return settingsReads === 1
          ? Promise.resolve(mockJsonResponse({ data: [] }))
          : delayedReload.promise;
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Create Setting' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Setting key'), { target: { value: 'decision.auto_publish_threshold' } });
    fireEvent.change(screen.getByLabelText('Setting value'), { target: { value: '88' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create setting' }));

    await waitFor(() => expect(settingsReads).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Overview section' }));
    delayedReload.resolve();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible());
    expect(screen.queryByText('Setting created.')).not.toBeInTheDocument();
  });

  it('keeps newer settings when an older reload resolves late', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/settings');
    const initialLoad = deferredJsonResponse({
      data: [
        {
          id: 1,
          client_id: null,
          setting_key: 'stale.setting',
          setting_value: 10,
          value_type: 'integer',
          description: '',
          is_active: true,
          updated_at: '2026-05-01T10:00:00Z',
        },
      ],
    });
    let settingsReads = 0;

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/settings') && method === 'POST') {
        return Promise.resolve(mockJsonResponse({ data: { id: 8 } }));
      }

      if (path.endsWith('/settings')) {
        settingsReads += 1;

        return settingsReads === 1
          ? initialLoad.promise
          : Promise.resolve(mockJsonResponse({
            data: [
              {
                id: 8,
                client_id: null,
                setting_key: 'decision.auto_publish_threshold',
                setting_value: 88,
                value_type: 'integer',
                description: '',
                is_active: true,
                updated_at: '2026-05-01T10:01:00Z',
              },
            ],
          }));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Create Setting' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Setting key'), { target: { value: 'decision.auto_publish_threshold' } });
    fireEvent.change(screen.getByLabelText('Setting value'), { target: { value: '88' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create setting' }));

    await waitFor(() => expect(settingsReads).toBe(2));
    expect(await screen.findByText('decision.auto_publish_threshold')).toBeVisible();

    await act(async () => {
      initialLoad.resolve();
    });

    expect(screen.queryByText('stale.setting')).not.toBeInTheDocument();
    expect(screen.getByText('decision.auto_publish_threshold')).toBeVisible();
  });

  it('loads providers and submits write-only credential actions', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/providers');
    let createdPayload = null;
    let testedPayload = null;
    let updatedPayload = null;
    const providerPages = {
      1: {
        data: [
          {
            id: 4,
            code: 'brave',
            name: 'Brave Search',
            driver: 'brave',
            base_url: 'https://api.search.brave.com',
            config: { supports_image_search: true },
            priority: 10,
            timeout_seconds: 15,
            rate_limit_per_minute: 60,
            is_active: false,
            has_api_key: true,
            has_api_secret: false,
          },
        ],
        meta: { current_page: 1, last_page: 2 },
      },
      2: {
        data: [
          {
            id: 6,
            code: 'google_custom_search',
            name: 'Google Custom Search',
            driver: 'google_custom_search',
            base_url: 'https://customsearch.googleapis.com',
            config: { supports_image_search: true },
            priority: 30,
            timeout_seconds: 15,
            rate_limit_per_minute: 30,
            is_active: false,
            has_api_key: false,
            has_api_secret: false,
          },
        ],
        meta: { current_page: 2, last_page: 2 },
      },
    };

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/search-providers') && method === 'POST') {
        createdPayload = JSON.parse(options.body);
        return Promise.resolve(mockJsonResponse({ data: { id: 5, ...createdPayload, has_api_key: true, has_api_secret: false } }));
      }

      if (path.endsWith('/search-providers/4/test') && method === 'POST') {
        testedPayload = JSON.parse(options.body);

        return Promise.resolve(mockJsonResponse({
          data: {
            provider_id: 4,
            code: 'brave',
            driver: 'brave',
            provider_active: false,
            has_api_key: true,
            has_api_secret: false,
            mode: 'images',
            status: 'empty',
            latency_ms: 12,
            results_count: 0,
            attempts: [{ sequence: 1, method: 'searchImages', status: 'empty' }],
            message: 'Provider responded without results for the test query.',
            tested_at: '2026-05-01T18:00:00.000000Z',
          },
        }));
      }

      if (path.endsWith('/search-providers/4') && method === 'PUT') {
        updatedPayload = JSON.parse(options.body);

        return Promise.resolve(mockJsonResponse({
          data: {
            id: 4,
            ...providerPages[1].data[0],
            ...updatedPayload,
            has_api_key: true,
            has_api_secret: false,
          },
        }));
      }

      if (path.endsWith('/search-providers')) {
        const page = Number(requestUrl.searchParams.get('page') ?? 1);

        return Promise.resolve(mockJsonResponse(providerPages[page] ?? { data: [], meta: { current_page: page, last_page: page } }));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    const providerHeading = await screen.findByRole('heading', { name: 'Create Provider' });
    const providerForm = providerHeading.closest('section');
    expect(providerHeading).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Product image discovery search providers' })).toHaveTextContent('brave');
    expect(screen.getByRole('table', { name: 'Product image discovery search providers' })).toHaveTextContent('google_custom_search');
    const braveRow = screen.getByRole('row', { name: /brave/i });
    fireEvent.click(within(braveRow).getByRole('button', { name: 'Test' }));

    await waitFor(() => expect(testedPayload).toEqual({ mode: 'images', limit: 1 }));
    expect(await screen.findByRole('region', { name: 'Provider test details' })).toHaveTextContent('empty');
    expect(screen.getByRole('region', { name: 'Provider test result' })).toHaveTextContent('key configured');
    fireEvent.click(within(braveRow).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(providerForm).getByLabelText('Name'), { target: { value: 'Brave Updated' } });
    fireEvent.click(within(providerForm).getByRole('button', { name: 'Save provider' }));

    await waitFor(() => expect(updatedPayload).toMatchObject({ name: 'Brave Updated' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Provider test result' })).not.toBeInTheDocument());

    fireEvent.change(within(providerForm).getByLabelText('Code'), { target: { value: 'serpapi-client' } });
    fireEvent.change(within(providerForm).getByLabelText('Name'), { target: { value: 'SerpAPI Client' } });
    fireEvent.change(within(providerForm).getByLabelText('Driver'), { target: { value: 'serpapi' } });
    fireEvent.change(within(providerForm).getByLabelText('API key action'), { target: { value: 'replace' } });
    fireEvent.change(within(providerForm).getByLabelText('API key value'), { target: { value: 'secret-key' } });
    fireEvent.change(within(providerForm).getByLabelText('API secret action'), { target: { value: 'clear' } });
    expect(screen.getByRole('region', { name: 'Provider payload preview' })).not.toHaveTextContent('secret-key');
    expect(screen.getByRole('region', { name: 'Provider payload preview' })).toHaveTextContent('(replace)');
    fireEvent.click(within(providerForm).getByRole('button', { name: 'Create provider' }));

    await waitFor(() => expect(createdPayload).toMatchObject({
      code: 'serpapi-client',
      name: 'SerpAPI Client',
      driver: 'serpapi',
      api_key: 'secret-key',
      api_secret: '',
      priority: 100,
      timeout_seconds: 15,
      is_active: true,
    }));
  });

  it('loads trusted sources and submits policy flags', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/trusted');
    let createdPayload = null;
    const trustedSourcesPayload = {
      data: [
        {
          id: 9,
          client_id: 77,
          domain: 'brand.example.test',
          source_name: 'Brand Site',
          source_type: 'brand_site',
          trust_score: 94,
          allow_search: true,
          allow_scraping: true,
          allow_download: true,
          allow_auto_publish: false,
          allow_description_import: false,
          respect_robots_txt: true,
          requires_manual_review: true,
          rate_limit_per_minute: 30,
          brand_scope: ['Acme'],
          supplier_scope: ['Primary'],
          url_patterns: ['https://brand.example.test/*'],
          permission_reference: 'Contract 42',
          notes: 'Approved source',
          is_active: true,
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/trusted-sources') && method === 'POST') {
        createdPayload = JSON.parse(options.body);
        return Promise.resolve(mockJsonResponse({ data: { id: 10, ...createdPayload } }));
      }

      if (path.endsWith('/trusted-sources')) {
        return Promise.resolve(mockJsonResponse(trustedSourcesPayload));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    const trustedHeading = await screen.findByRole('heading', { name: 'Create Trusted Source' });
    const trustedForm = trustedHeading.closest('section');
    expect(trustedHeading).toBeVisible();
    expect(await screen.findByText('brand.example.test')).toBeVisible();

    fireEvent.change(within(trustedForm).getByLabelText('Client override'), { target: { value: '42' } });
    fireEvent.change(within(trustedForm).getByLabelText('Domain'), { target: { value: 'supplier.example.test' } });
    fireEvent.change(within(trustedForm).getByLabelText('Source name'), { target: { value: 'Supplier Site' } });
    fireEvent.change(within(trustedForm).getByLabelText('Source type'), { target: { value: 'supplier' } });
    fireEvent.change(within(trustedForm).getByLabelText('Trust score', { selector: 'input[aria-label="Trust score"]' }), { target: { value: '91' } });
    fireEvent.change(within(trustedForm).getByLabelText('Allow auto publish'), { target: { value: 'true' } });
    fireEvent.change(within(trustedForm).getByLabelText('Requires manual review'), { target: { value: 'false' } });
    fireEvent.change(within(trustedForm).getByLabelText('Brand scope'), { target: { value: 'Acme\nRoad Runner' } });
    fireEvent.change(within(trustedForm).getByLabelText('URL patterns'), { target: { value: 'https://supplier.example.test/*' } });
    fireEvent.click(within(trustedForm).getByRole('button', { name: 'Create trusted source' }));

    await waitFor(() => expect(createdPayload).toMatchObject({
      client_id: 42,
      domain: 'supplier.example.test',
      source_name: 'Supplier Site',
      source_type: 'supplier',
      trust_score: 91,
      allow_auto_publish: true,
      requires_manual_review: false,
      brand_scope: ['Acme', 'Road Runner'],
      url_patterns: ['https://supplier.example.test/*'],
    }));
  });

  it('loads runtime health without exposing secrets', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/health');
    const healthPayload = {
      data: {
        app: {
          environment: 'testing',
          debug: false,
          admin_prefix: 'admin/product-image-discovery',
          package_api_prefix: 'api/product-image-discovery',
          secret_probe: 'app-secret',
        },
        env_status: [
          { key: 'BRAVE_SEARCH_PROVIDER', scope: 'search', configured: false },
          { key: 'ANTHROPIC_API_KEY', scope: 'ai', configured: true },
        ],
        ai: {
          enabled: true,
          provider: 'anthropic',
          timeout_seconds: 45,
          fail_silently: true,
          attach_remote_image: false,
          vision_model_configured: true,
          description_model_configured: false,
          provider_key_configured: true,
          providers: [
            { provider: 'anthropic', api_key_configured: true, base_url_configured: true, api_key: 'anthropic-secret' },
            { provider: 'openrouter', api_key_configured: false, base_url_configured: false },
          ],
        },
        storage: { disk: 'local', configured: true, driver: 'local' },
        queue: {
          connection: 'sync',
          queues: [
            { phase: 'ingest', queue: 'image-discovery-ingest', status: 'configured' },
            { phase: 'analysis', queue: 'image-discovery-ai', status: 'configured' },
          ],
        },
        providers: [
          {
            id: 1,
            code: 'fake',
            driver: 'fake',
            active: true,
            has_api_key: false,
            has_api_secret: false,
            timeout_seconds: null,
            rate_limit_per_minute: null,
            last_test_status: null,
            last_test_at: null,
            raw_secret: 'provider-secret',
          },
        ],
      },
    };

    vi.stubGlobal('fetch', vi.fn((url) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/health')) {
        return Promise.resolve(mockJsonResponse(healthPayload));
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Runtime Health' })).toBeVisible();
    expect(screen.getByText('api/product-image-discovery')).toBeVisible();
    expect(screen.getByText('ANTHROPIC_API_KEY')).toBeVisible();
    expect(screen.getByRole('table', { name: 'AI provider credential status' })).toHaveTextContent('default');
    expect(screen.getByRole('table', { name: 'Search provider health status' })).toHaveTextContent('fake');
    expect(screen.getByRole('table', { name: 'Search provider health status' })).toHaveTextContent('- / no rate');
    expect(screen.getByRole('table', { name: 'Search provider health status' })).not.toHaveTextContent('-s');
    expect(screen.getByRole('table', { name: 'Product image discovery queue status' })).toHaveTextContent('image-discovery-ai');
    expect(document.body).not.toHaveTextContent('app-secret');
    expect(document.body).not.toHaveTextContent('anthropic-secret');
    expect(document.body).not.toHaveTextContent('provider-secret');
  });

  it('runs the API workbench sample request and redacts captured responses', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/apitest');
    let createdPayload = null;
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({
          data: [
            {
              id: 44,
              status: 'manual_review',
              erp_model_color_id: 'ERP-44',
            },
          ],
        }));
      }

      if (path.endsWith('/health')) {
        return Promise.resolve(mockJsonResponse({
          data: {
            app: { environment: 'testing' },
            ai: { provider: 'anthropic', provider_key_configured: true },
            storage: { disk: 'local', configured: true },
            queue: { connection: 'sync', queues: [{ phase: 'ingest', queue: 'image-discovery-ingest', status: 'configured' }] },
            providers: [],
          },
        }));
      }

      if (path.includes('/search-providers') && method === 'GET') {
        return Promise.resolve(mockJsonResponse({
          data: [
            { id: 7, code: 'fake', driver: 'fake', is_active: true },
          ],
          meta: { last_page: 1 },
        }));
      }

      if (path.endsWith('/requests') && method === 'POST') {
        createdPayload = JSON.parse(options.body);

        return Promise.resolve(mockJsonResponse({
          ok: true,
          request_id: 55,
          erp_model_color_id: createdPayload.erp_model_color_id,
          status: 'queued',
          token: 'server-token',
        }, 201));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'API Test Workbench' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Sample ERP color'), { target: { value: 'WORKBENCH-TEST-CAMMELLO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create sample request' }));

    await waitFor(() => expect(createdPayload).toMatchObject({
      erp_model_id: 'WORKBENCH-HERNO',
      erp_model_color_id: 'WORKBENCH-TEST-CAMMELLO',
      metadata: { admin_workbench: true },
    }));

    expect(await screen.findByRole('table', { name: 'API workbench calls' })).toHaveTextContent('/requests');
    expect(screen.getByLabelText('Request ID')).toHaveValue('55');
    expect(screen.getByLabelText('API workbench response')).toHaveTextContent('"status": 201');
    expect(screen.getByLabelText('API workbench response')).toHaveTextContent('"token": "[redacted]"');
    expect(document.body).not.toHaveTextContent('server-token');

    fireEvent.click(within(screen.getByRole('table', { name: 'API workbench calls' })).getByRole('button', { name: 'cURL' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('X-CSRF-TOKEN: <csrf-token>')));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Cookie: <authenticated-session-cookie>'));
  });

  it('debug page exposes optional package fields in the default payload and the hint', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/debug');
    window.localStorage.removeItem('pid-debug-flow-draft');

    vi.stubGlobal('fetch', vi.fn((url) => {
      const path = new URL(String(url)).pathname;

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search') || path.endsWith('/debug-runs')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    }));

    render(<App />);

    const textarea = await screen.findByLabelText('Request JSON');
    const initialPayload = JSON.parse(textarea.value);

    expect(initialPayload).toMatchObject({
      description: '',
      ean: '',
      season: '',
      material: '',
      metadata: {},
    });

    const hint = screen.getByText(/The package also reads/i);
    expect(hint).toHaveTextContent('description');
    expect(hint).toHaveTextContent('ean');
    expect(hint).toHaveTextContent('season');
    expect(hint).toHaveTextContent('material');
    expect(hint).toHaveTextContent('metadata');
  });

  it('runs debug flow from JSON and redacts previewed secrets', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/debug');
    let createdPayload = null;

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/debug-runs') && method === 'POST') {
        createdPayload = JSON.parse(options.body);

        return Promise.resolve(mockJsonResponse({
          data: {
            id: 7,
            status: 'succeeded',
            request_payload: { ...createdPayload.request_payload, api_key: '[redacted]' },
            options: createdPayload.options,
            summary: { candidate_count: 1, candidates_checked: 1 },
            request_summary: {
              erp_model_color_id: createdPayload.request_payload.erp_model_color_id,
              final_score: 82,
            },
            report_available: true,
            report: {
              summary: { candidate_count: 1, candidates_checked: 1 },
              request: { erp_model_color_id: createdPayload.request_payload.erp_model_color_id },
              config: { api_key: 'server-secret' },
              provider: { has_api_key: true, has_api_secret: false },
            },
            exit_code: 0,
            updated_at: '2026-05-01T12:00:00Z',
          },
        }));
      }

      if (path.endsWith('/debug-runs')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Run Debug Flow' })).toBeVisible();
    const requestPayload = {
      client_id: 1,
      erp_model_id: 'HERNO-PI002223D',
      erp_model_color_id: 'HERNO-PI002223D-CAMMELLO',
      brand: 'Herno',
      api_key: 'front-secret',
    };

    fireEvent.change(screen.getByLabelText('Request JSON'), {
      target: { value: JSON.stringify(requestPayload, null, 2) },
    });
    fireEvent.change(screen.getByLabelText('Max candidates'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Good score'), { target: { value: 'not-a-score' } });

    expect(screen.getByRole('region', { name: 'Debug payload preview' })).not.toHaveTextContent('front-secret');
    await waitFor(() => expect(window.localStorage.getItem('pid-debug-flow-draft')).not.toContain('front-secret'));
    expect(window.localStorage.getItem('pid-debug-flow-draft')).toContain('[redacted]');
    fireEvent.click(screen.getByRole('button', { name: 'Run debug flow' }));

    await waitFor(() => expect(createdPayload).toMatchObject({
      request_payload: requestPayload,
      options: { max_candidates: 50, good_score: null, no_download: true, no_env_brave: true },
    }));
    expect(await screen.findByRole('region', { name: 'Debug run result' })).toHaveTextContent('HERNO-PI002223D-CAMMELLO');
    expect(screen.getByRole('region', { name: 'Debug run report' })).not.toHaveTextContent('server-secret');
    expect(screen.getByRole('region', { name: 'Debug run report' })).toHaveTextContent('"has_api_key": true');
    expect(screen.getByText('Debug run completed.')).toBeVisible();
  });

  it('fetches a completed debug run report when opening a historical row', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/debug');

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/debug-runs/9') && method === 'GET') {
        return Promise.resolve(mockJsonResponse({
          data: {
            id: 9,
            status: 'succeeded',
            request_payload: { erp_model_color_id: 'ARCHIVE-COLOR' },
            summary: { candidate_count: 1 },
            request_summary: { erp_model_color_id: 'ARCHIVE-COLOR' },
            report: { evidence: { marker: 'full archived report' } },
            report_available: true,
            updated_at: '2026-05-01T12:00:00Z',
          },
        }));
      }

      if (path.endsWith('/debug-runs') && method === 'GET') {
        return Promise.resolve(mockJsonResponse({
          data: [{
            id: 9,
            status: 'succeeded',
            request_payload: { erp_model_color_id: 'ARCHIVE-COLOR' },
            summary: { candidate_count: 1 },
            request_summary: { erp_model_color_id: 'ARCHIVE-COLOR' },
            report: null,
            report_available: true,
            updated_at: '2026-05-01T12:00:00Z',
          }],
        }));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    await screen.findByRole('row', { name: /ARCHIVE-COLOR/ });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(await screen.findByRole('region', { name: 'Debug run report' })).toHaveTextContent('full archived report');
  });

  it('waits for each debug run poll before scheduling the next one', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/debug');
    const debugTimers = [];
    const debugTimerIds = new Set();
    const realSetTimeout = window.setTimeout.bind(window);
    const realClearTimeout = window.clearTimeout.bind(window);
    const firstPoll = deferredJsonResponse({
      data: {
        id: 12,
        status: 'running',
        request_payload: { erp_model_color_id: 'POLL-COLOR' },
        summary: null,
        request_summary: { erp_model_color_id: 'POLL-COLOR' },
        report: null,
        report_available: false,
        updated_at: '2026-05-01T12:00:00Z',
      },
    });
    const secondPoll = deferredJsonResponse({
      data: {
        id: 12,
        status: 'succeeded',
        request_payload: { erp_model_color_id: 'POLL-COLOR' },
        summary: { candidate_count: 1 },
        request_summary: { erp_model_color_id: 'POLL-COLOR' },
        report: { done: true },
        report_available: true,
        updated_at: '2026-05-01T12:00:01Z',
      },
    });
    let pollReads = 0;

    vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay, ...args) => {
      if (delay === 1500) {
        const timerId = { debugPoll: true };

        debugTimers.push(() => (typeof callback === 'function' ? callback(...args) : undefined));
        debugTimerIds.add(timerId);

        return timerId;
      }

      return realSetTimeout(callback, delay, ...args);
    });
    vi.spyOn(window, 'clearTimeout').mockImplementation((id) => {
      if (debugTimerIds.has(id)) {
        debugTimerIds.delete(id);

        return undefined;
      }

      return realClearTimeout(id);
    });

    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/debug-runs') && method === 'POST') {
        return Promise.resolve(mockJsonResponse({
          data: {
            id: 12,
            status: 'running',
            request_payload: { erp_model_color_id: 'POLL-COLOR' },
            summary: null,
            request_summary: { erp_model_color_id: 'POLL-COLOR' },
            report: null,
            report_available: false,
            updated_at: '2026-05-01T12:00:00Z',
          },
        }));
      }

      if (path.endsWith('/debug-runs/12') && method === 'GET') {
        pollReads += 1;

        return pollReads === 1 ? firstPoll.promise : secondPoll.promise;
      }

      if (path.endsWith('/debug-runs') && method === 'GET') {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Run Debug Flow' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Run debug flow' }));

    await waitFor(() => expect(debugTimers).toHaveLength(1));
    const runFirstPoll = debugTimers.shift();

    act(() => {
      runFirstPoll();
    });

    expect(pollReads).toBe(1);
    expect(debugTimers).toHaveLength(0);

    await act(async () => {
      firstPoll.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(debugTimers).toHaveLength(1));
    const runSecondPoll = debugTimers.shift();

    act(() => {
      runSecondPoll();
    });

    expect(pollReads).toBe(2);

    await act(async () => {
      secondPoll.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByRole('region', { name: 'Debug run report' })).toHaveTextContent('"done": true');
  });

  it('loads stored debug reports and filters candidate evidence', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/reports');
    const writeText = vi.fn().mockResolvedValue(undefined);
    const reportPayload = {
      summary: {
        completed_at: '2026-05-01T12:00:00Z',
      },
      config: { api_key: 'server-secret' },
      request: {
        status: 'manual_review',
        final_score: 72,
        erp_model_color_id: 'REPORT-COLOR',
      },
      search: {
        provider: 'fake-debug',
        result_count: 2,
      },
      candidates: [
        {
          id: 2,
          status: 'rejected',
          title: 'Clean candidate',
          source_domain: 'example.test',
          image_url: '',
          source_page_url: 'javascript:alert(1)',
          scores: { final_score: 20, quality_score: 0 },
          evidence: { mismatches: [], matches: [] },
          ai_verification: { match: true },
        },
        {
          id: 1,
          status: 'verified_match',
          title: 'Mismatch candidate',
          source_domain: 'example.test',
          image_url: 'https://images.example.test/herno.jpg',
          source_page_url: 'https://source.example.test/product/herno',
          local_original_path: 'product-image-discovery/1/original.jpg',
          scores: { final_score: 72, quality_score: 80 },
          evidence: { mismatches: ['color_mismatch'], matches: ['brand_match'] },
          ai_verification: { match: false, rejection_reason: 'wrong_color' },
          quality_analysis: { passed: true, quality_score: 80 },
        },
      ],
      downloaded_candidate_ids: [1],
      quality_candidate_ids: [1],
      events: [{ event_type: 'pipeline.debug.completed', message: 'done' }],
    };

    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });
    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;
      const method = options.method ?? 'GET';

      if (path.endsWith('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 0, manual_review: 0, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      if (path.endsWith('/debug-runs/9/report') && method === 'GET') {
        return Promise.resolve(mockJsonResponse({
          data: {
            id: 9,
            status: 'succeeded',
            report: reportPayload,
            report_available: true,
          },
        }));
      }

      if (path.endsWith('/debug-runs') && method === 'GET') {
        return Promise.resolve(mockJsonResponse({
          data: [{
            id: 9,
            status: 'succeeded',
            request_payload: { erp_model_color_id: 'REPORT-COLOR' },
            summary: { candidate_count: 2 },
            request_summary: { erp_model_color_id: 'REPORT-COLOR' },
            report: null,
            report_available: true,
            updated_at: '2026-05-01T12:00:00Z',
          }],
        }));
      }

      return Promise.reject(new Error(`Unexpected request: ${method} ${path}`));
    }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Load Debug Report' })).toBeVisible();
    await screen.findByRole('table', { name: 'Stored debug reports' });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const summary = await screen.findByRole('region', { name: 'Debug report summary' });

    expect(summary).toHaveTextContent('manual_review');
    expect(summary).toHaveTextContent('Candidates2');
    expect(summary).toHaveTextContent('Verified1');
    expect(screen.getByRole('region', { name: 'Debug report inspector' })).not.toHaveTextContent('server-secret');

    fireEvent.click(screen.getByRole('button', { name: 'Candidates' }));
    const candidatesTable = screen.getByRole('table', { name: 'Debug report candidates' });
    expect(candidatesTable).toHaveTextContent('Mismatch candidate');
    expect(candidatesTable).toHaveTextContent('Clean candidate');

    const dataRows = within(candidatesTable).getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('Mismatch candidate');
    expect(dataRows[1]).toHaveTextContent('Clean candidate');

    const mismatchUrlAnchor = within(dataRows[0]).getByRole('link', { name: 'View URL' });
    expect(mismatchUrlAnchor).toHaveAttribute('href', 'https://source.example.test/product/herno');
    expect(mismatchUrlAnchor).toHaveAttribute('target', '_blank');
    expect(mismatchUrlAnchor).toHaveAttribute('rel', 'noopener noreferrer');

    const mismatchImageAnchor = within(dataRows[0]).getByRole('link', { name: 'View Image' });
    expect(mismatchImageAnchor).toHaveAttribute('href', 'https://images.example.test/herno.jpg');
    expect(mismatchImageAnchor).toHaveAttribute('target', '_blank');
    expect(mismatchImageAnchor).toHaveAttribute('rel', 'noopener noreferrer');

    const cleanUrlChip = within(dataRows[1]).getByText('View URL');
    expect(cleanUrlChip).not.toHaveAttribute('href');
    expect(cleanUrlChip).toHaveAttribute('aria-disabled', 'true');
    expect(cleanUrlChip.className).toContain('pid-chip-button--disabled');

    const cleanImageChip = within(dataRows[1]).getByText('View Image');
    expect(cleanImageChip).not.toHaveAttribute('href');
    expect(cleanImageChip).toHaveAttribute('aria-disabled', 'true');
    expect(cleanImageChip.className).toContain('pid-chip-button--disabled');

    fireEvent.click(screen.getByLabelText('Only mismatches'));
    const filteredTable = screen.getByRole('table', { name: 'Debug report candidates' });
    expect(filteredTable).toHaveTextContent('Mismatch candidate');
    expect(filteredTable).not.toHaveTextContent('Clean candidate');
    expect(summary).toHaveTextContent('Candidates2');
    expect(summary).toHaveTextContent('Verified1');

    fireEvent.change(screen.getByLabelText('Search JSON'), { target: { value: 'color_mismatch' } });
    expect(screen.getByRole('table', { name: 'Debug report JSON matches' })).toHaveTextContent('color_mismatch');
    fireEvent.click(screen.getAllByRole('button', { name: 'Path' })[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('mismatches')));
  });

  it('keeps the request detail drawer open while loading selected request data', async () => {
    window.PID_ADMIN = { apiBase: '/custom-admin/product-image-discovery' };
    window.history.replaceState({}, '', '/custom-admin/product-image-discovery/requests');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          mockJsonResponse({
            counts: { total: 1, manual_review: 1, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
            provider_status: [],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 44,
                status: 'manual_review',
                final_score: 61,
                brand: 'Herno',
                supplier: 'Herno',
                erp_model_color_id: 'HERO-001-BLK',
                updated_at: '2026-04-30T09:30:00Z',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 44,
                status: 'manual_review',
                final_score: 61,
                brand: 'Herno',
                supplier: 'Herno',
                erp_model_color_id: 'HERO-001-BLK',
                updated_at: '2026-04-30T09:30:00Z',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: {
              id: 44,
              status: 'manual_review',
              final_score: 61,
              brand: 'Herno',
              supplier: 'Herno',
              erp_model_color_id: 'HERO-001-BLK',
              best_candidate: { id: 301 },
              selected_candidate: null,
              candidates: [],
            },
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [{ id: 1, event_type: 'pipeline.started', message: null, level: 'info', created_at: '2026-04-30T09:30:00Z' }],
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 301,
                status: 'candidate',
                final_score: 91,
                source_domain: 'cdn.example.test',
                source_page_url: 'javascript:alert(1)',
              },
            ],
          }),
        ),
    );

    render(<App />);

    await screen.findByRole('button', { name: 'Open' });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(await screen.findByRole('dialog', { name: 'Request 44' })).toBeVisible();
    expect(screen.getByText('Summary')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Compare mode' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open source' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open source' }));
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.getByText('info')).toBeVisible();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect((await screen.findAllByAltText('Candidate 301 preview'))[0]).toHaveAttribute(
      'src',
      '/custom-admin/product-image-discovery/candidates/301/image',
    );
  });

  it('keeps stale request detail responses from overwriting the latest drawer selection', async () => {
    window.history.replaceState({}, '', '/admin/product-image-discovery/requests');
    const slowDetail = deferredJsonResponse({
      data: {
        id: 44,
        status: 'manual_review',
        final_score: 61,
        brand: 'Herno',
        supplier: 'Herno',
        erp_model_color_id: 'HERO-001-BLK',
        best_candidate: null,
        selected_candidate: null,
        candidates: [],
      },
    });
    const slowEvents = deferredJsonResponse({ data: [] });
    const slowCandidates = deferredJsonResponse({ data: [] });
    const requestRows = {
      data: [
        {
          id: 44,
          status: 'manual_review',
          final_score: 61,
          brand: 'Herno',
          supplier: 'Herno',
          erp_model_color_id: 'HERO-001-BLK',
          updated_at: '2026-04-30T09:30:00Z',
        },
        {
          id: 45,
          status: 'manual_review',
          final_score: 74,
          brand: 'Nike',
          supplier: 'Nike',
          erp_model_color_id: 'NIKE-001-WHT',
          updated_at: '2026-04-30T10:00:00Z',
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn((url) => {
      const requestUrl = new URL(String(url));
      const path = `${requestUrl.pathname}${requestUrl.search}`;

      if (path.includes('/dashboard-summary')) {
        return Promise.resolve(mockJsonResponse({
          counts: { total: 2, manual_review: 2, ready_to_publish: 0, failed: 0, no_candidates_found: 0 },
          provider_status: [],
        }));
      }

      if (path.includes('/requests/search')) {
        return Promise.resolve(mockJsonResponse(requestRows));
      }

      if (path.endsWith('/requests/44')) {
        return slowDetail.promise;
      }

      if (path.endsWith('/requests/44/events')) {
        return slowEvents.promise;
      }

      if (path.endsWith('/requests/44/candidates')) {
        return slowCandidates.promise;
      }

      if (path.endsWith('/requests/45')) {
        return Promise.resolve(mockJsonResponse({
          data: {
            id: 45,
            status: 'manual_review',
            final_score: 74,
            brand: 'Nike',
            supplier: 'Nike',
            erp_model_color_id: 'NIKE-001-WHT',
            best_candidate: null,
            selected_candidate: null,
            candidates: [],
          },
        }));
      }

      if (path.endsWith('/requests/45/events') || path.endsWith('/requests/45/candidates')) {
        return Promise.resolve(mockJsonResponse({ data: [] }));
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    }));

    render(<App />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(2));
    const [openFirst, openSecond] = screen.getAllByRole('button', { name: 'Open' });

    fireEvent.click(openFirst);
    fireEvent.click(openSecond);

    expect(await screen.findByRole('dialog', { name: 'Request 45' })).toBeVisible();

    slowDetail.resolve();
    slowEvents.resolve();
    slowCandidates.resolve();

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Request 45' })).toBeVisible());
    expect(screen.queryByRole('dialog', { name: 'Request 44' })).not.toBeInTheDocument();
  });

  it('renders the json viewer and copies content', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });

    render(<JsonViewer value={{ alpha: 1, beta: 'two' }} label="Preview" />);

    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    expect(screen.getByText(/"alpha": 1/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ alpha: 1, beta: 'two' }, null, 2));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();
  });

  it('normalizes legacy candidate image paths through the configured admin base path', () => {
    window.PID_ADMIN = { apiBase: '/custom-admin/product-image-discovery/' };

    render(
      <ImageTile
        src="/admin/product-image-discovery/candidates/301/image"
        alt="Candidate preview"
        caption="Candidate"
      />,
    );

    expect(screen.getByAltText('Candidate preview')).toHaveAttribute(
      'src',
      '/custom-admin/product-image-discovery/candidates/301/image',
    );
  });

  it('keeps the json viewer stable when clipboard writes fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });

    render(<JsonViewer value={{ alpha: 1 }} label="Preview" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
  });
});
