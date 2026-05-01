import { describe, expect, it } from 'vitest';
import { parseIntegerInput } from '../../resources/js/admin-product-image-discovery/form-utils';

describe('form utility helpers', () => {
  it('parses shared integer inputs with nullable and bounded validation', () => {
    expect(parseIntegerInput(' 42 ', 'Limit')).toEqual({ ok: true, value: 42 });
    expect(parseIntegerInput('', 'Limit', { nullable: true })).toEqual({ ok: true, value: null });
    expect(parseIntegerInput('', 'Limit')).toEqual({ ok: false, error: 'Limit is required.' });
    expect(parseIntegerInput('1e2', 'Limit')).toEqual({ ok: false, error: 'Limit must be a whole number.' });
    expect(parseIntegerInput('101', 'Limit', { min: 0, max: 100 })).toEqual({
      ok: false,
      error: 'Limit must be between 0 and 100.',
    });
  });
});
