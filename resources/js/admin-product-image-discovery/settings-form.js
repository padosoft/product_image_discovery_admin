export const SETTING_VALUE_TYPES = ['json', 'string', 'integer', 'float', 'boolean', 'null'];

export const DEFAULT_SETTING_FORM = {
  id: null,
  client_id: '',
  setting_key: '',
  setting_value: '',
  value_type: 'integer',
  description: '',
  is_active: true,
};

export function formatSettingValueForInput(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export function settingToForm(setting) {
  return {
    id: setting.id ?? null,
    client_id: setting.client_id ?? '',
    setting_key: setting.setting_key ?? '',
    setting_value: formatSettingValueForInput(setting.setting_value),
    value_type: setting.value_type || 'json',
    description: setting.description ?? '',
    is_active: Boolean(setting.is_active),
  };
}

export function parseSettingValue(rawValue, valueType) {
  const raw = String(rawValue ?? '').trim();

  switch (valueType) {
    case 'json':
      try {
        return { ok: true, value: JSON.parse(raw || 'null') };
      } catch (err) {
        void err;

        return { ok: false, error: 'Setting value must be valid JSON.' };
      }
    case 'integer': {
      if (!/^-?\d+$/.test(raw)) {
        return { ok: false, error: 'Setting value must be an integer.' };
      }

      return { ok: true, value: Number.parseInt(raw, 10) };
    }
    case 'float': {
      const parsed = Number(raw);

      if (!raw || Number.isNaN(parsed)) {
        return { ok: false, error: 'Setting value must be a number.' };
      }

      return { ok: true, value: parsed };
    }
    case 'boolean':
      if (!['true', 'false'].includes(raw.toLowerCase())) {
        return { ok: false, error: 'Setting value must be true or false.' };
      }

      return { ok: true, value: raw.toLowerCase() === 'true' };
    case 'null':
      return { ok: true, value: null };
    case 'string':
    default:
      return { ok: true, value: rawValue ?? '' };
  }
}

export function buildSettingPayload(form) {
  const parsed = parseSettingValue(form.setting_value, form.value_type);

  if (!parsed.ok) {
    return parsed;
  }

  const clientId = form.client_id === '' ? null : Number.parseInt(form.client_id, 10);

  if (form.client_id !== '' && (!Number.isInteger(clientId) || clientId < 1)) {
    return { ok: false, error: 'Client id must be a positive integer.' };
  }

  return {
    ok: true,
    value: {
      client_id: clientId,
      setting_key: form.setting_key.trim(),
      setting_value: parsed.value,
      value_type: form.value_type,
      description: form.description.trim() || null,
      is_active: Boolean(form.is_active),
    },
  };
}
