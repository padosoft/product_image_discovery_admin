import { describe, expect, it } from 'vitest';
import {
  buildSettingPayload,
  parseSettingValue,
  settingToForm,
} from '../../resources/js/admin-product-image-discovery/settings-form';

describe('settings form helpers', () => {
  it('parses typed values before sending settings to the API', () => {
    expect(parseSettingValue('42', 'integer')).toEqual({ ok: true, value: 42 });
    expect(parseSettingValue('65.5', 'float')).toEqual({ ok: true, value: 65.5 });
    expect(parseSettingValue('65abc', 'float')).toEqual({ ok: false, error: 'Setting value must be a number.' });
    expect(parseSettingValue('1e309', 'float')).toEqual({ ok: false, error: 'Setting value must be a number.' });
    expect(parseSettingValue('false', 'boolean')).toEqual({ ok: true, value: false });
    expect(parseSettingValue('{"enabled":true}', 'json')).toEqual({ ok: true, value: { enabled: true } });
    expect(parseSettingValue('not-json', 'json')).toEqual({ ok: false, error: 'Setting value must be valid JSON.' });
  });

  it('builds a payload with null global client scope and inactive state', () => {
    expect(buildSettingPayload({
      client_id: '',
      setting_key: 'decision.manual_review_threshold',
      setting_value: '60',
      value_type: 'integer',
      description: '',
      is_active: false,
    })).toEqual({
      ok: true,
      value: {
        client_id: null,
        setting_key: 'decision.manual_review_threshold',
        setting_value: 60,
        value_type: 'integer',
        description: null,
        is_active: false,
      },
    });
  });

  it('rejects invalid client ids before submit', () => {
    ['abc', '5.9', '1e2'].forEach((clientId) => {
      expect(buildSettingPayload({
        client_id: clientId,
        setting_key: 'decision.manual_review_threshold',
        setting_value: '60',
        value_type: 'integer',
        description: '',
        is_active: true,
      })).toEqual({ ok: false, error: 'Client id must be a positive integer.' });
    });
  });

  it('formats object values for editing', () => {
    expect(settingToForm({
      id: 7,
      client_id: 3,
      setting_key: 'quality.allowed_mime_types',
      setting_value: ['image/jpeg'],
      value_type: 'json',
      description: null,
      is_active: true,
    })).toMatchObject({
      id: 7,
      client_id: 3,
      setting_key: 'quality.allowed_mime_types',
      setting_value: '[\n  "image/jpeg"\n]',
      value_type: 'json',
      description: '',
      is_active: true,
    });
  });
});
