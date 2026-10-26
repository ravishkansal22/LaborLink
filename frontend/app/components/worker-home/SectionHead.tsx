'use client';

import { ChevronRight } from 'lucide-react';
import styles from './SectionHead.module.css';

interface SectionHeadProps {
  title: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHead({ title, meta, actionLabel, onAction }: SectionHeadProps) {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {actionLabel && onAction ? (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
          <ChevronRight size={15} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
