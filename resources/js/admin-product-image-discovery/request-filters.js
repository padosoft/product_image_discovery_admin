const DEFAULT_FILTERS = {
  client_id: '',
  status: '',
  brand: '',
  supplier: '',
  erp_model_id: '',
  erp_model_color_id: '',
  ean: '',
  source_domain: '',
  rejection_reason: '',
  min_score: '',
  max_score: '',
  manual_review_required: '',
  has_candidates: '',
  has_selected_image: '',
  created_from: '',
  created_to: '',
  updated_from: '',
  updated_to: '',
  sort_by: 'created_at',
  sort_direction: 'desc',
  per_page: '15',
};

const BOOLEAN_FIELDS = new Set(['manual_review_required', 'has_candidates', 'has_selected_image']);
export const SAVED_REQUEST_FILTERS_KEY = 'pid-request-saved-filters';

export function createDefaultRequestFilters() {
  return { ...DEFAULT_FILTERS };
}

export function requestFiltersFromSearchParams(searchParams) {
  const filters = createDefaultRequestFilters();

  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(filters, key)) {
      filters[key] = value;
    }
  }

  return filters;
}

export function requestFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) {
      return;
    }

    params.set(key, BOOLEAN_FIELDS.has(key) ? String(value === true || value === 'true') : String(value));
  });

  return params;
}

export function requestFiltersToActiveChips(filters) {
  return Object.entries(filters)
    .filter(([key, value]) => value !== '' && value !== null && value !== undefined && key !== 'sort_by' && key !== 'sort_direction' && key !== 'per_page')
    .map(([key, value]) => ({
      key,
      label: key.replaceAll('_', ' '),
      value: String(value),
    }));
}

export function buildRequestExportPath(filters) {
  const { per_page: _perPage, ...exportFilters } = filters;
  const params = requestFiltersToSearchParams(exportFilters);
  const query = params.toString();

  return query ? `/requests/export.csv?${query}` : '/requests/export.csv';
}

export function saveRequestFilters(filters, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SAVED_REQUEST_FILTERS_KEY, JSON.stringify({
      ...createDefaultRequestFilters(),
      ...filters,
    }));

    return true;
  } catch (err) {
    void err;

    return false;
  }
}

export function loadRequestFilters(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVED_REQUEST_FILTERS_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const defaults = createDefaultRequestFilters();

    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => {
        const value = parsed[key];

        return [key, ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : fallback];
      }),
    );
  } catch (err) {
    void err;

    return null;
  }
}

export function clearSavedRequestFilters(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(SAVED_REQUEST_FILTERS_KEY);

    return true;
  } catch (err) {
    void err;

    return false;
  }
}
