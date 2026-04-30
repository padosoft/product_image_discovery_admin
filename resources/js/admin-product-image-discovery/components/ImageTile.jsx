import React from 'react';
import { StatusBadge } from './StatusBadge';

export function ImageTile({ src, alt, status, caption }) {
  return (
    <figure className="pid-image-tile">
      <div className="pid-image-tile__frame">
        <img src={src} alt={alt} loading="lazy" />
      </div>
      <figcaption>
        <div>{caption}</div>
        {status ? <StatusBadge status={status} /> : null}
      </figcaption>
    </figure>
  );
}
