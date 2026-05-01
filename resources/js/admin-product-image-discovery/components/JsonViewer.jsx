import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  const resetTimer = useRef(null);

  const text = useMemo(() => formatJson(value), [value]);

  useEffect(() => () => {
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
    }
  }, []);

  async function handleCopy() {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
      }

      resetTimer.current = window.setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, 1200);
    } catch {
      setCopied(false);
    }
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
