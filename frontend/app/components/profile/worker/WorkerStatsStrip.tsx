'use client';

import { t } from '../../../lib/i18n';

interface WorkerStatsStripProps {
  jobsCompleted: number;
  radiusKm: number;
  joinedLabel: string;
}

export function WorkerStatsStrip({
  jobsCompleted,
  radiusKm,
  joinedLabel,
}: WorkerStatsStripProps) {
  return (
    <div className="wp-stats" role="group" aria-label={t('Profile stats')}>
      <div className="wp-stat">
        <span className="wp-stat-value">{jobsCompleted}</span>
        <span className="wp-stat-label">{t('Jobs completed')}</span>
      </div>
      <div className="wp-stat">
        <span className="wp-stat-value">
          {radiusKm} {t('km')}
        </span>
        <span className="wp-stat-label">{t('Work radius')}</span>
      </div>
      <div className="wp-stat">
        <span className="wp-stat-value">{joinedLabel}</span>
        <span className="wp-stat-label">{t('Joined')}</span>
      </div>
    </div>
  );
}
