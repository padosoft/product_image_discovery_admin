import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRUSTED_SOURCE_FORM,
  buildTrustedSourcePayload,
  trustedSourceToForm,
} from '../../resources/js/admin-product-image-discovery/trusted-source-form';

describe('trusted source form helpers', () => {
  it('builds typed trusted source payloads with list fields', () => {
    const payload = buildTrustedSourcePayload({
      ...DEFAULT_TRUSTED_SOURCE_FORM,
      client_id: '77',
      domain: 'brand.example.test',
      source_name: 'Brand Site',
      source_type: 'brand_site',
      trust_score: '94',
      allow_auto_publish: 'true',
      requires_manual_review: 'false',
      brand_scope: 'Acme\nRoad Runner',
      supplier_scope: 'Primary, Outlet',
      url_patterns: 'https://brand.example.test/*',
      rate_limit_per_minute: '40',
    });

    expect(payload.ok).toBe(true);
    expect(payload.value).toMatchObject({
      client_id: 77,
      domain: 'brand.example.test',
      source_name: 'Brand Site',
      source_type: 'brand_site',
      trust_score: 94,
      allow_auto_publish: true,
      requires_manual_review: false,
      brand_scope: ['Acme', 'Road Runner'],
      supplier_scope: ['Primary', 'Outlet'],
      url_patterns: ['https://brand.example.test/*'],
      rate_limit_per_minute: 40,
    });
  });

  it('formats API records for editing without losing policy flags', () => {
    const form = trustedSourceToForm({
      id: 9,
      client_id: 77,
      domain: 'brand.example.test',
      source_name: 'Brand Site',
      source_type: 'brand_site',
      trust_score: 94,
      allow_search: true,
      allow_scraping: false,
      allow_download: true,
      allow_auto_publish: true,
      allow_description_import: false,
      respect_robots_txt: true,
      requires_manual_review: false,
      rate_limit_per_minute: 40,
      brand_scope: ['Acme'],
      supplier_scope: ['Primary'],
      url_patterns: ['https://brand.example.test/*'],
      permission_reference: 'Contract 42',
      notes: 'Approved source',
      is_active: true,
    });

    expect(form.allow_scraping).toBe('false');
    expect(form.allow_auto_publish).toBe('true');
    expect(form.requires_manual_review).toBe('false');
    expect(form.brand_scope).toBe('Acme');
    expect(form.url_patterns).toBe('https://brand.example.test/*');
  });

  it('rejects invalid numeric values before submit', () => {
    expect(buildTrustedSourcePayload({
      ...DEFAULT_TRUSTED_SOURCE_FORM,
      domain: 'brand.example.test',
      client_id: '3.2',
    })).toMatchObject({ ok: false, error: 'Client id must be a whole number.' });

    expect(buildTrustedSourcePayload({
      ...DEFAULT_TRUSTED_SOURCE_FORM,
      domain: 'brand.example.test',
      trust_score: '101',
    })).toMatchObject({ ok: false, error: 'Trust score must be between 0 and 100.' });
  });
});
