'use client';

import { ArrowRight, Search } from 'lucide-react';
import { t } from '../../../lib/i18n';
import styles from './ActionSearchButton.module.css';

interface ActionSearchButtonProps {
  /** Original "Describe a new job" handler — opens newJob with no trade. */
  onDescribeJob: () => void;
}

/**
 * Full-width search-style pill that starts the existing describe-new-job flow.
 * Matches Uber/Ola monochrome search style with white CTA arrow.
 */
export function ActionSearchButton({ onDescribeJob }: ActionSearchButtonProps) {
  return (
    <button
      type="button"
      className={styles.pill}
      onClick={onDescribeJob}
      aria-label={t('Search for a job or worker')}
    >
      <Search size={18} strokeWidth={2} className={styles.searchIcon} aria-hidden />
      <span className={styles.label}>
        {t('Search for a job or worker…')}
      </span>
      <span className={styles.arrowCircle} aria-hidden>
        <ArrowRight size={18} strokeWidth={2.5} />
      </span>
    </button>
  );
}
