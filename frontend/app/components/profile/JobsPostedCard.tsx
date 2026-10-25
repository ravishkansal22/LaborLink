'use client';

/**
 * JobsPostedCard
 *
 * White rounded card showing:
 *  - Doc icon tile
 *  - "Jobs posted" title + "View and manage your posted jobs" subtitle
 *  - Bold count right-aligned
 *  - Chevron
 *
 * Uses the SAME count (session.jobIds.length) and navigation (go.jobs)
 * as the old SettingRow in EmployerProfileScreen.
 */

import { ChevronRight, ClipboardList } from 'lucide-react';
import { t } from '../../lib/i18n';

interface JobsPostedCardProps {
  count: number;
  onNavigate: () => void;
}

export function JobsPostedCard({ count, onNavigate }: JobsPostedCardProps) {
  return (
    <button
      type="button"
      className="prof-jobs-card"
      onClick={onNavigate}
      aria-label={t('Jobs posted from this phone: {n}', { n: count })}
    >
      <span className="tile-icon" aria-hidden="true">
        <ClipboardList size={20} strokeWidth={1.8} />
      </span>
      <div className="grow">
        <p className="prof-jobs-title">{t('Jobs posted')}</p>
        <p className="prof-jobs-sub">{t('View and manage your posted jobs')}</p>
      </div>
      <strong className="prof-jobs-count">{count}</strong>
      <ChevronRight size={18} className="muted" aria-hidden="true" />
    </button>
  );
}
