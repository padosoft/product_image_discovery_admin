import React, { useMemo, useState } from 'react';

function formatJson(value) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value ?? '');
  }
}

export function JsonViewer({ value, label = 'JSON preview' }) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => formatJson(value), [value]);

  async function handleCopy() {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="pid-json-viewer" aria-label={label}>
      <div className="pid-json-viewer__bar">
        <strong>{label}</strong>
        <button type="button" className="pid-chip-button" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="pid-json-viewer__code">{text}</pre>
    </section>
  );
}
