import React from 'react';
import { DEFAULT_ADMIN_API_BASE, buildAdminApiPath } from '../api';
import { StatusBadge } from './StatusBadge';

function normalizeCandidateImageSrc(src) {
  if (typeof src !== 'string') {
    return src;
  }

  const defaultCandidatePrefix = `${DEFAULT_ADMIN_API_BASE}/candidates/`;

  if (!src.startsWith(defaultCandidatePrefix)) {
    return src;
  }

  return buildAdminApiPath(src.slice(DEFAULT_ADMIN_API_BASE.length));
}

export function ImageTile({ src, alt, status, caption }) {
  const imageSrc = normalizeCandidateImageSrc(src);

  return (
    <figure className="pid-image-tile">
      <div className="pid-image-tile__frame">
        <img src={imageSrc} alt={alt} loading="lazy" />
      </div>
      <figcaption>
        <div>{caption}</div>
        {status ? <StatusBadge status={status} /> : null}
      </figcaption>
    </figure>
  );
}
