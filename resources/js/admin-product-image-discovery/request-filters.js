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
