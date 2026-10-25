'use client';

/**
 * Display-only base location. Legacy SettingRow had no onClick, so this row
 * is not tappable and has no chevron. Green pin matches LocationHeader tokens.
 * Shared LocationPicker opener: useLocation().openPicker() — not wired here
 * because no existing worker base-location change handler exists.
 */

import { MapPin } from 'lucide-react';
import { t } from '../../../lib/i18n';

interface WorkerBaseLocationRowProps {
  subtitle: string;
}

export function WorkerBaseLocationRow({ subtitle }: WorkerBaseLocationRowProps) {
  return (
    <div className="wp-loc-row" aria-label={t('Base location')}>
      <span className="wp-loc-icon" aria-hidden="true">
        <MapPin size={20} strokeWidth={1.75} />
      </span>
      <span className="acct-row-body">
        <span className="acct-row-title">{t('Base location')}</span>
        <span className="acct-row-sub">{subtitle}</span>
      </span>
    </div>
  );
}
