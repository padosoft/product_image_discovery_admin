import { parseIntegerInput } from './form-utils';

export const PROVIDER_DRIVERS = [
  'brave',
  'tavily',
  'exa',
  'firecrawl',
  'websearchapi',
  'duckduckgo',
  'searchapi',
  'youcom',
  'fake',
];

export const PROVIDER_SECRET_MODES = [
  { value: 'keep', label: 'Keep current value' },
  { value: 'replace', label: 'Replace value' },
  { value: 'clear', label: 'Clear value' },
];

export const DEFAULT_PROVIDER_FORM = {
  id: null,
  code: '',
  name: '',
  driver: 'brave',
  base_url: '',
  config: '{}',
  priority: '100',
  timeout_seconds: '15',
  rate_limit_per_minute: '',
  is_active: 'true',
  has_api_key: false,
  has_api_secret: false,
  api_key_mode: 'keep',
  api_key: '',
  api_secret_mode: 'keep',
  api_secret: '',
};

function booleanToFormValue(value, fallback = true) {
  if (value === null || value === undefined) {
    return fallback ? 'true' : 'false';
  }

  return value ? 'true' : 'false';
}

function formatJsonForInput(value) {
  if (value === null || value === undefined) {
    return '{}';
  }

  return JSON.stringify(value, null, 2);
}

function parseConfig(rawValue) {
  const raw = String(rawValue ?? '').trim();

  if (raw === '') {
    return { ok: true, value: null };
  }

  try {
    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object') {
      return { ok: false, error: 'Config must be a JSON object or array.' };
    }

    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: 'Config must contain valid JSON.' };
  }
}

function applySecretMode(payload, form, field, modeField) {
  const mode = form[modeField] || 'keep';
  const value = String(form[field] ?? '');

  if (mode === 'keep') {
    return { ok: true };
  }

  if (mode === 'clear') {
    payload[field] = '';
    return { ok: true };
  }

  if (mode === 'replace') {
    if (!value.trim()) {
      return { ok: false, error: `${field.replace('_', ' ')} is required when replacing it.` };
    }

    payload[field] = value;
    return { ok: true };
  }

  return { ok: false, error: `Unsupported ${field.replace('_', ' ')} action.` };
}

export function providerToForm(provider) {
  return {
    ...DEFAULT_PROVIDER_FORM,
    id: provider.id ?? null,
    code: provider.code ?? '',
    name: provider.name ?? '',
    driver: provider.driver ?? DEFAULT_PROVIDER_FORM.driver,
    base_url: provider.base_url ?? '',
    config: formatJsonForInput(provider.config ?? {}),
    priority: String(provider.priority ?? DEFAULT_PROVIDER_FORM.priority),
    timeout_seconds: String(provider.timeout_seconds ?? DEFAULT_PROVIDER_FORM.timeout_seconds),
    rate_limit_per_minute: provider.rate_limit_per_minute === null || provider.rate_limit_per_minute === undefined
      ? ''
      : String(provider.rate_limit_per_minute),
    is_active: booleanToFormValue(provider.is_active),
    has_api_key: Boolean(provider.has_api_key),
    has_api_secret: Boolean(provider.has_api_secret),
    api_key_mode: 'keep',
    api_key: '',
    api_secret_mode: 'keep',
    api_secret: '',
  };
}

export function buildProviderPayload(form) {
  const code = String(form.code ?? '').trim().toLowerCase();
  const name = String(form.name ?? '').trim();
  const driver = String(form.driver ?? '').trim();

  if (!code) {
    return { ok: false, error: 'Provider code is required.' };
  }

  if (!name) {
    return { ok: false, error: 'Provider name is required.' };
  }

  if (!driver) {
    return { ok: false, error: 'Provider driver is required.' };
  }

  const priority = parseIntegerInput(form.priority, 'Priority', { min: 0, max: 65535 });
  const timeout = parseIntegerInput(form.timeout_seconds, 'Timeout seconds', { min: 1, max: 300 });
  const rateLimit = parseIntegerInput(form.rate_limit_per_minute, 'Rate limit per minute', { min: 1, nullable: true });
  const config = parseConfig(form.config);

  for (const result of [priority, timeout, rateLimit, config]) {
    if (!result.ok) {
      return result;
    }
  }

  const payload = {
    code,
    name,
    driver,
    base_url: String(form.base_url ?? '').trim() || null,
    config: config.value,
    priority: priority.value,
    timeout_seconds: timeout.value,
    rate_limit_per_minute: rateLimit.value,
    is_active: String(form.is_active) === 'true',
  };

  for (const [field, modeField] of [['api_key', 'api_key_mode'], ['api_secret', 'api_secret_mode']]) {
    const result = applySecretMode(payload, form, field, modeField);

    if (!result.ok) {
      return result;
    }
  }

  return { ok: true, value: payload };
}

export function redactProviderPayloadPreview(payloadResult) {
  if (!payloadResult.ok) {
    return { error: payloadResult.error };
  }

  const preview = { ...payloadResult.value };

  for (const field of ['api_key', 'api_secret']) {
    if (!Object.prototype.hasOwnProperty.call(preview, field)) {
      continue;
    }

    preview[field] = preview[field] === '' ? '(clear)' : '(replace)';
  }

  return preview;
}
