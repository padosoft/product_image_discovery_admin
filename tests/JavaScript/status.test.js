import { describe, expect, it } from 'vitest';
import { scoreTone, statusTone } from '../../resources/js/admin-product-image-discovery/status';

describe('status mapping', () => {
  it('maps manual review to warning', () => {
    expect(statusTone('manual_review')).toBe('warn');
  });

  it('maps report candidate statuses', () => {
    expect(statusTone('verified_match')).toBe('ok');
    expect(statusTone('quality_failed')).toBe('danger');
  });

  it('maps scores into risk bands', () => {
    expect(scoreTone(55)).toBe('danger');
    expect(scoreTone(65)).toBe('warn');
    expect(scoreTone(95)).toBe('ok');
  });

  it('treats non-numeric scores as neutral', () => {
    expect(scoreTone('N/A')).toBe('neutral');
  });
});
