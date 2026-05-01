import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../resources/js/admin-product-image-discovery/App';
import { ImageTile } from '../../resources/js/admin-product-image-discovery/components/ImageTile';
import { JsonViewer } from '../../resources/js/admin-product-image-discovery/components/JsonViewer';

function mockJsonResponse(payload) {
  return {
    ok: true,
    status: 200,
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

    await waitFor(() => expect(window.location.search).toContain('manual_review_required=true'));
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
