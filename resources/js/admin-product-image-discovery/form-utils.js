export function parseIntegerInput(rawValue, label, { min = 0, max = Number.MAX_SAFE_INTEGER, nullable = false } = {}) {
  const raw = String(rawValue ?? '').trim();

  if (raw === '') {
    return nullable
      ? { ok: true, value: null }
      : { ok: false, error: `${label} is required.` };
  }

  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    return { ok: false, error: `${label} must be between ${min} and ${max}.` };
  }

  return { ok: true, value };
}
