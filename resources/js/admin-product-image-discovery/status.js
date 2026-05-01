export const STATUS_GROUPS = {
  pending: 'info',
  queued: 'info',
  searching: 'info',
  extracting: 'info',
  verifying: 'info',
  quality_checking: 'info',
  candidates_found: 'info',
  matched: 'ok',
  downloaded: 'ok',
  quality_passed: 'ok',
  ready_to_publish: 'ok',
  published: 'ok',
  manual_review: 'warn',
  no_candidates_found: 'warn',
  rejected: 'danger',
  failed: 'danger',
};

export function statusTone(status) {
  return STATUS_GROUPS[status] ?? 'neutral';
}

export function scoreTone(score) {
  if (score === null || score === undefined || score === '') {
    return 'neutral';
  }

  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) {
    return 'neutral';
  }

  if (numericScore >= 80) {
    return 'ok';
  }

  if (numericScore >= 60) {
    return 'warn';
  }

  return 'danger';
}
