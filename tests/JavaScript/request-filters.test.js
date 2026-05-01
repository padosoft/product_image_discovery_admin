import { describe, expect, it } from 'vitest';
import {
  createDefaultRequestFilters,
  requestFiltersFromSearchParams,
  requestFiltersToActiveChips,
  requestFiltersToSearchParams,
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
});
