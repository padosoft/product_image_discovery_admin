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

export async function pidFetch(path, options = {}) {
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal ?? controller?.signal;
  const token = document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  const url = path.startsWith('http') ? path : `${window.PID_ADMIN?.apiBase ?? '/admin/product-image-discovery'}${path}`;

  const response = await fetch(url, {
    ...options,
    signal,
    headers: {
      ...DEFAULT_HEADERS,
      'X-CSRF-TOKEN': token,
      ...(options.headers ?? {}),
    },
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}
