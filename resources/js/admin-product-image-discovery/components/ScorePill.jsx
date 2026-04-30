import React from 'react';
import { scoreTone } from '../status';

export function ScorePill({ score }) {
  if (score === null || score === undefined) {
    return <span className="pid-score pid-score--neutral">not scored</span>;
  }

  return <span className={`pid-score pid-score--${scoreTone(score)}`}>{score}</span>;
}
