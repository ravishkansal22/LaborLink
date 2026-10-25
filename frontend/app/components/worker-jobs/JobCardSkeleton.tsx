'use client';

import styles from './JobCard.module.css';
import sk from './JobCardSkeleton.module.css';

export function JobCardSkeleton({ snap = false }: { snap?: boolean }) {
  return (
    <div className={`${styles.card} ${snap ? styles.snap : ''} ${sk.root}`} aria-hidden>
      <div className={`${sk.block} ${sk.art}`} />
      <div className={sk.meta}>
        <div className={`${sk.block} ${sk.chip}`} />
        <div className={`${sk.block} ${sk.title}`} />
        <div className={`${sk.block} ${sk.facts}`} />
      </div>
      <div className={`${sk.block} ${sk.apply}`} />
    </div>
  );
}
