import { describe, expect, it, vi } from 'vitest';
import { ApiError, normalizeApiError, normalizeLaravelPagination, pidFetch } from '../../resources/js/admin-product-image-discovery/api';

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
});
