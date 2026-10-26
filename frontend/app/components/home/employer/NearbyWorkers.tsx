'use client';

import { Users } from 'lucide-react';
import { t } from '../../../lib/i18n';
import { SectionHeader } from './SectionHeader';
import styles from './NearbyWorkers.module.css';

interface NearbyWorkersProps {
  /** Starts the original describe-new-job flow (empty-state CTA). */
  onDescribeJob: () => void;
  onViewAll: () => void;
}

/**
 * "Workers near you" — no home-level nearby-workers API exists in frontend/.
 * Renders an honest empty state. When a real list endpoint/hook is added,
 * plug it in below (horizontal scroll-snap cards) without inventing data.
 */
export function NearbyWorkers({ onDescribeJob, onViewAll }: NearbyWorkersProps) {
  return (
    <section aria-label={t('Workers near you')}>
      <SectionHeader
        title={t('Workers near you')}
        actionLabel={t('View all')}
        onAction={onViewAll}
        actionAriaLabel={t('View all')}
      />

      {/* Future: real nearby-workers list (hook/API) plugs in here — scroll-snap row. */}
      <button
        type="button"
        className={styles.empty}
        onClick={onDescribeJob}
        aria-label={t('Describe a new job')}
      >
        <span className={styles.emptyIcon} aria-hidden>
          <Users size={22} strokeWidth={1.75} />
        </span>
        <span className={styles.emptyBody}>
          <strong className={styles.emptyTitle}>
            {t('Workers near you will appear here')}
          </strong>
          <span className={styles.emptyText}>
            {t('Describe a job to get offers from workers nearby.')}
          </span>
        </span>
      </button>
    </section>
  );
}
