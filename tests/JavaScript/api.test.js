import { describe, expect, it } from 'vitest';
import { ApiError, normalizeApiError, normalizeLaravelPagination } from '../../resources/js/admin-product-image-discovery/api';

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
});
