import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVIDER_FORM,
  buildProviderPayload,
  providerToForm,
} from '../../resources/js/admin-product-image-discovery/provider-form';

describe('provider form helpers', () => {
  it('keeps configured secrets out of edit payloads by default', () => {
    const form = providerToForm({
      id: 4,
      code: 'brave',
      name: 'Brave Search',
      driver: 'brave',
      base_url: 'https://api.search.brave.com',
      config: { supports_image_search: true },
      priority: 10,
      timeout_seconds: 15,
      rate_limit_per_minute: 60,
      is_active: true,
      has_api_key: true,
      has_api_secret: true,
    });

    const payload = buildProviderPayload(form);

    expect(payload.ok).toBe(true);
    expect(payload.value).not.toHaveProperty('api_key');
    expect(payload.value).not.toHaveProperty('api_secret');
    expect(form.api_key).toBe('');
    expect(form.api_secret).toBe('');
  });

  it('sends replacement and clear actions explicitly', () => {
    const payload = buildProviderPayload({
      ...DEFAULT_PROVIDER_FORM,
      code: 'serpapi',
      name: 'SerpAPI',
      driver: 'serpapi',
      api_key_mode: 'replace',
      api_key: 'new-key',
      api_secret_mode: 'clear',
    });

    expect(payload.ok).toBe(true);
    expect(payload.value.api_key).toBe('new-key');
    expect(payload.value.api_secret).toBe('');
  });

  it('validates JSON config and numeric limits before submit', () => {
    expect(buildProviderPayload({
      ...DEFAULT_PROVIDER_FORM,
      code: 'fake-demo',
      name: 'Fake Demo',
      driver: 'fake',
      config: '"not an object"',
    })).toMatchObject({ ok: false, error: 'Config must be a JSON object or array.' });

    expect(buildProviderPayload({
      ...DEFAULT_PROVIDER_FORM,
      code: 'fake-demo',
      name: 'Fake Demo',
      driver: 'fake',
      priority: '1e2',
    })).toMatchObject({ ok: false, error: 'Priority must be a whole number.' });
  });
});
