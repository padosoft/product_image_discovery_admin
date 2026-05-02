import { describe, expect, it } from 'vitest';
import {
  SAVED_REQUEST_FILTERS_KEY,
  buildRequestExportPath,
  clearSavedRequestFilters,
  createDefaultRequestFilters,
  loadRequestFilters,
  requestFiltersFromSearchParams,
  requestFiltersToActiveChips,
  requestFiltersToSearchParams,
  saveRequestFilters,
} from '../../resources/js/admin-product-image-discovery/request-filters';

describe('request filters', () => {
  it('round trips search params', () => {
    const filters = requestFiltersFromSearchParams(new URLSearchParams('brand=Herno&manual_review_required=true&per_page=25'));

    expect(filters.brand).toBe('Herno');
    expect(filters.manual_review_required).toBe('true');
    expect(filters.per_page).toBe('25');
  });

  it('serializes active chips and search params', () => {
    const filters = {
      ...createDefaultRequestFilters(),
      brand: 'Herno',
      manual_review_required: 'true',
    };

    expect(requestFiltersToSearchParams(filters).toString()).toContain('brand=Herno');
    expect(requestFiltersToActiveChips(filters)).toEqual([
      { key: 'brand', label: 'brand', value: 'Herno' },
      { key: 'manual_review_required', label: 'manual review required', value: 'true' },
    ]);
  });

  it('builds export urls from active request filters', () => {
    const filters = {
      ...createDefaultRequestFilters(),
      brand: 'Herno',
      status: 'manual_review',
    };

    expect(buildRequestExportPath(filters)).toBe('/requests/export.csv?status=manual_review&brand=Herno&sort_by=created_at&sort_direction=desc');
  });

  it('persists saved filters with localStorage guards', () => {
    const storage = new Map();
    const localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    };
    const filters = {
      ...createDefaultRequestFilters(),
      brand: 'Nike',
      manual_review_required: 'true',
    };

    expect(saveRequestFilters(filters, localStorage)).toBe(true);
    expect(JSON.parse(storage.get(SAVED_REQUEST_FILTERS_KEY)).brand).toBe('Nike');
    expect(loadRequestFilters(localStorage)).toMatchObject({
      brand: 'Nike',
      manual_review_required: 'true',
      per_page: '15',
    });
    expect(clearSavedRequestFilters(localStorage)).toBe(true);
    expect(loadRequestFilters(localStorage)).toBeNull();
  });

  it('reports missing browser storage as unavailable without throwing', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    expect(saveRequestFilters(createDefaultRequestFilters(), {})).toBe(false);
    expect(saveRequestFilters(createDefaultRequestFilters(), throwingStorage)).toBe(false);
    expect(loadRequestFilters(throwingStorage)).toBeNull();
    expect(clearSavedRequestFilters(throwingStorage)).toBe(false);
  });
});
