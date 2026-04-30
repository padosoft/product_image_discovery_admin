const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function normalizeLaravelPagination(payload) {
  if (!payload || typeof payload !== 'object') {
    return { data: [], meta: null, links: null };
  }

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta ?? null,
    links: payload.links ?? null,
  };
}

export function buildRequestSearchPath(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) {
      return;
    }

    params.set(key, String(value));
  });

  const query = params.toString();

  return query ? `/requests/search?${query}` : '/requests/search';
}

async function readResponsePayload(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers?.get?.('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text?.().catch(() => '') ?? '';

  if (!text) {
    return null;
  }

  return { message: text };
}

export function normalizeApiError(response, payload) {
  const message = payload?.message
    || payload?.error
    || `Request failed with status ${response.status}`;

  return new ApiError(message, response.status, payload);
}

export async function pidFetch(path, options = {}) {
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal ?? controller?.signal;
  const isAbsolute = /^https?:\/\//i.test(path);
  const url = isAbsolute ? path : `${window.PID_ADMIN?.apiBase ?? '/admin/product-image-discovery'}${path}`;
  const token = isAbsolute ? null : (document.querySelector('meta[name="csrf-token"]')?.content ?? '');
  const csrfHeader = token ? { 'X-CSRF-TOKEN': token } : {};

  const response = await fetch(url, {
    ...options,
    signal,
    headers: {
      ...DEFAULT_HEADERS,
      ...csrfHeader,
      ...(options.headers ?? {}),
    },
  });

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw normalizeApiError(response, payload);
  }

  return payload;
}
