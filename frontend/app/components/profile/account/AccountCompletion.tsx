'use client';

import { t } from '../../../lib/i18n';

interface AccountCompletionProps {
  pct: number;
  onOpenEdit: () => void;
}

export function AccountCompletion({ pct, onOpenEdit }: AccountCompletionProps) {
  const complete = pct >= 100;

  if (complete) {
    return (
      <p className="acct-completion-done" role="status">
        {t('Profile complete')} ✓
      </p>
    );
  }

  return (
    <button
      type="button"
      className="acct-completion"
      onClick={onOpenEdit}
      aria-label={t('Complete your profile')}
    >
      <span className="acct-completion-label">
        {t('Complete your profile')} · {pct}%
      </span>
      <div
        className="acct-completion-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('Profile completion')}
      >
        <span className="acct-completion-fill" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}
