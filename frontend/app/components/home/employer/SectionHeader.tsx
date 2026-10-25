'use client';

import { ChevronRight } from 'lucide-react';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Accessible name for the action control when label alone is unclear. */
  actionAriaLabel?: string;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionAriaLabel,
}: SectionHeaderProps) {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      {actionLabel && onAction ? (
        <button
          type="button"
          className={styles.action}
          onClick={onAction}
          aria-label={actionAriaLabel ?? actionLabel}
        >
          {actionLabel}
          <ChevronRight size={15} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
