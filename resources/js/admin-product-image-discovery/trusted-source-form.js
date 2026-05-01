import { parseIntegerInput } from './form-utils';

export const TRUSTED_SOURCE_TYPES = [
  'website',
  'brand_site',
  'supplier',
  'retailer',
  'marketplace',
];

export const DEFAULT_TRUSTED_SOURCE_FORM = {
  id: null,
  client_id: '',
  domain: '',
  source_name: '',
  source_type: 'website',
  trust_score: '80',
  allow_search: 'true',
  allow_scraping: 'true',
  allow_download: 'true',
  allow_auto_publish: 'false',
  allow_description_import: 'false',
  respect_robots_txt: 'true',
  requires_manual_review: 'true',
  rate_limit_per_minute: '',
  brand_scope: '',
  supplier_scope: '',
  url_patterns: '',
  permission_reference: '',
  notes: '',
  is_active: 'true',
};

function booleanToFormValue(value, fallback = false) {
  if (value === null || value === undefined) {
    return fallback ? 'true' : 'false';
  }

  return value ? 'true' : 'false';
}

function listToInput(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function parseListInput(rawValue) {
  const values = String(rawValue ?? '')
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : null;
}

export function trustedSourceToForm(source) {
  return {
    ...DEFAULT_TRUSTED_SOURCE_FORM,
    id: source.id ?? null,
    client_id: source.client_id === null || source.client_id === undefined ? '' : String(source.client_id),
    domain: source.domain ?? '',
    source_name: source.source_name ?? '',
    source_type: source.source_type ?? DEFAULT_TRUSTED_SOURCE_FORM.source_type,
    trust_score: String(source.trust_score ?? DEFAULT_TRUSTED_SOURCE_FORM.trust_score),
    allow_search: booleanToFormValue(source.allow_search, true),
    allow_scraping: booleanToFormValue(source.allow_scraping, true),
    allow_download: booleanToFormValue(source.allow_download, true),
    allow_auto_publish: booleanToFormValue(source.allow_auto_publish),
    allow_description_import: booleanToFormValue(source.allow_description_import),
    respect_robots_txt: booleanToFormValue(source.respect_robots_txt, true),
    requires_manual_review: booleanToFormValue(source.requires_manual_review, true),
    rate_limit_per_minute: source.rate_limit_per_minute === null || source.rate_limit_per_minute === undefined
      ? ''
      : String(source.rate_limit_per_minute),
    brand_scope: listToInput(source.brand_scope),
    supplier_scope: listToInput(source.supplier_scope),
    url_patterns: listToInput(source.url_patterns),
    permission_reference: source.permission_reference ?? '',
    notes: source.notes ?? '',
    is_active: booleanToFormValue(source.is_active, true),
  };
}

export function buildTrustedSourcePayload(form) {
  const domain = String(form.domain ?? '').trim();

  if (!domain) {
    return { ok: false, error: 'Domain is required.' };
  }

  const clientId = parseIntegerInput(form.client_id, 'Client id', { min: 1, nullable: true });
  const trustScore = parseIntegerInput(form.trust_score, 'Trust score', { min: 0, max: 100 });
  const rateLimit = parseIntegerInput(form.rate_limit_per_minute, 'Rate limit per minute', { min: 1, nullable: true });

  for (const result of [clientId, trustScore, rateLimit]) {
    if (!result.ok) {
      return result;
    }
  }

  return {
    ok: true,
    value: {
      client_id: clientId.value,
      domain,
      source_name: String(form.source_name ?? '').trim() || null,
      source_type: String(form.source_type ?? '').trim() || DEFAULT_TRUSTED_SOURCE_FORM.source_type,
      trust_score: trustScore.value,
      allow_search: String(form.allow_search) === 'true',
      allow_scraping: String(form.allow_scraping) === 'true',
      allow_download: String(form.allow_download) === 'true',
      allow_auto_publish: String(form.allow_auto_publish) === 'true',
      allow_description_import: String(form.allow_description_import) === 'true',
      respect_robots_txt: String(form.respect_robots_txt) === 'true',
      requires_manual_review: String(form.requires_manual_review) === 'true',
      rate_limit_per_minute: rateLimit.value,
      brand_scope: parseListInput(form.brand_scope),
      supplier_scope: parseListInput(form.supplier_scope),
      url_patterns: parseListInput(form.url_patterns),
      permission_reference: String(form.permission_reference ?? '').trim() || null,
      notes: String(form.notes ?? '').trim() || null,
      is_active: String(form.is_active) === 'true',
    },
  };
}
