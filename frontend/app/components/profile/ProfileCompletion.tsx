'use client';

/**
 * ProfileCompletion
 *
 * Shows:
 *  - "Complete your profile" label
 *  - Thin 6px animated progress bar (blue fill, light blue track)
 *  - Percentage right-aligned with tabular numbers
 *  - Below 100%: tapping opens Edit Profile focusing first missing field
 *  - At 100%: shows "Profile complete ✓", hides the CTA
 *
 * Accessibility: role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax
 * Animation: CSS transition on width (~400ms); prefers-reduced-motion respected via CSS
 */

import { Check } from 'lucide-react';
import { t } from '../../lib/i18n';

interface ProfileCompletionProps {
  pct: number; // 0–100
  onOpenEdit: () => void;
}

export function ProfileCompletion({ pct, onOpenEdit }: ProfileCompletionProps) {
  const complete = pct >= 100;

  return (
    <button
      type="button"
      className="prof-completion-wrap"
      onClick={complete ? undefined : onOpenEdit}
      disabled={complete}
      aria-disabled={complete}
    >
      <div className="prof-completion-top">
        {complete ? (
          <span className="prof-completion-label with-icon">
            <Check size={14} strokeWidth={2.5} className="prof-completion-check" />
            {t('Profile complete')}
          </span>
        ) : (
          <span className="prof-completion-label">{t('Complete your profile')}</span>
        )}
        <span
          className="prof-completion-pct"
          aria-label={`${pct}%`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {pct}%
        </span>
      </div>

      {!complete && (
        <div
          className="prof-progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('Profile completion')}
        >
          <span
            className="prof-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </button>
  );
}
