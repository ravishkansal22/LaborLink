'use client';

import { ArrowRight, Mic, Search } from 'lucide-react';
import { t } from '../../../lib/i18n';
import styles from './ActionSearchButton.module.css';

interface ActionSearchButtonProps {
  /** Original "Describe a new job" handler — opens newJob with no trade. */
  onDescribeJob: () => void;
}

/**
 * Full-width search-style pill that starts the existing describe-new-job flow.
 * Not a real input — the whole control is one button.
 */
export function ActionSearchButton({ onDescribeJob }: ActionSearchButtonProps) {
  return (
    <button
      type="button"
      className={styles.pill}
      onClick={onDescribeJob}
      aria-label={t('Describe a new job')}
    >
      <Search size={18} strokeWidth={2} className={styles.searchIcon} aria-hidden />
      <span className={styles.label}>
        {t('Describe your problem or search a worker…')}
      </span>
      <Mic size={16} strokeWidth={2.25} className={styles.micIcon} aria-hidden />
      <span className={styles.arrowCircle} aria-hidden>
        <ArrowRight size={18} strokeWidth={2.5} />
      </span>
    </button>
  );
}
