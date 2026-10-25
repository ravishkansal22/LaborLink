'use client';

/**
 * Placeholder until the ThemeSheet prompt. Honest "coming next" — no fake theme toggle.
 */

import { Palette } from 'lucide-react';
import { ProfileBottomSheet } from '../BottomSheet';
import { t } from '../../../lib/i18n';

interface ThemePlaceholderSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ThemePlaceholderSheet({ open, onClose }: ThemePlaceholderSheetProps) {
  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={t('Appearance')} noHandle>
      <div className="prof-cs-body">
        <span className="prof-cs-icon">
          <Palette size={32} strokeWidth={1.5} />
        </span>
        <p className="prof-cs-text">{t('Theme options coming next')}</p>
        <button type="button" className="btn btn-primary mt-12" onClick={onClose}>
          {t('Got it')}
        </button>
      </div>
    </ProfileBottomSheet>
  );
}
