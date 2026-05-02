import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  buildAdminApiPath,
  normalizeApiError,
  normalizeLaravelPagination,
  pidFetch,
  pidFetchWithMeta,
} from '../../resources/js/admin-product-image-discovery/api';

describe('api client helpers', () => {
  it('normalizes laravel pagination payloads', () => {
    expect(normalizeLaravelPagination(null)).toEqual({ data: [], meta: null, links: null });
    expect(normalizeLaravelPagination({ data: [1], meta: { page: 1 }, links: { next: 'x' } })).toEqual({
      data: [1],
      meta: { page: 1 },
      links: { next: 'x' },
    });
  });

  it('creates sanitized api errors from payloads', () => {
    const response = { status: 403 };
    const error = normalizeApiError(response, { message: 'Forbidden' });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Forbidden');
    expect(error.status).toBe(403);
    expect(error.payload).toEqual({ message: 'Forbidden' });
  });

  it('rejects cross-origin absolute urls before sending a fetch request', async () => {
    vi.stubGlobal('fetch', vi.fn());
    window.PID_ADMIN = { apiBase: '/admin/product-image-discovery' };

    await expect(pidFetch('https://evil.example.com/requests/1')).rejects.toThrow('Cross-origin admin requests are not allowed.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('builds admin api paths from the configured base path', () => {
    window.PID_ADMIN = { apiBase: '/custom-admin/product-image-discovery/' };

    expect(buildAdminApiPath('/candidates/301/image')).toBe('/custom-admin/product-image-discovery/candidates/301/image');
  });

  it('handles non-json responses without a text helper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      json: vi.fn(),
    }));
    window.PID_ADMIN = { apiBase: '/admin/product-image-discovery' };

    await expect(pidFetch('/health')).resolves.toBeNull();
  });

  it('returns fetch metadata without throwing for failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue({ message: 'Slow down' }),
    }));
    window.PID_ADMIN = { apiBase: '/admin/product-image-discovery' };

    await expect(pidFetchWithMeta('/requests')).resolves.toEqual({
      ok: false,
      status: 429,
      payload: { message: 'Slow down' },
    });
  });
});
