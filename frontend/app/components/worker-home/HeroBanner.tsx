'use client';

import { t } from '../../lib/i18n';
import styles from './HeroBanner.module.css';

interface HeroBannerProps {
  /** Real nearby jobs count when known; otherwise show caps label. */
  jobsCount: number | null;
  onBrowseJobs: () => void;
}

export function HeroBanner({ jobsCount, onBrowseJobs }: HeroBannerProps) {
  const kicker =
    jobsCount == null
      ? t('JOBS NEAR YOU')
      : jobsCount === 1
        ? t('1 job near you')
        : t('{n} jobs near you', { n: jobsCount });

  return (
    <section className={styles.banner} aria-label={kicker}>
      <div className={styles.copy}>
        <p className={jobsCount == null ? styles.kicker : styles.kickerCount}>{kicker}</p>
        <p className={styles.headline}>{t('Skilled work. Real opportunities.')}</p>
        <p className={styles.sub}>
          {t('Find jobs in your area and send your price.')}
        </p>
        <button type="button" className={styles.cta} onClick={onBrowseJobs}>
          {t('Browse Jobs')} <span aria-hidden>›</span>
        </button>
      </div>
      <svg
        className={styles.art}
        viewBox="0 0 120 120"
        width="108"
        height="108"
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id="whHat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfe0ff" />
            <stop offset="100%" stopColor="#7eabff" />
          </linearGradient>
          <linearGradient id="whBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8f0ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#8bb3ff" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx="62" cy="66" r="44" fill="#0a2a6e" opacity="0.28" />
        <path d="M30 108c6-28 20-40 32-40s26 12 32 40" fill="url(#whBody)" />
        <circle cx="62" cy="50" r="15" fill="#eaf1ff" opacity="0.92" />
        <path d="M40 50c2-15 11-22 22-22s20 7 22 22H40z" fill="url(#whHat)" />
        <ellipse cx="62" cy="50" rx="26" ry="4.5" fill="#b8d0ff" />
        <g transform="translate(86 74) rotate(24)" opacity="0.9">
          <rect x="0" y="3" width="20" height="4.5" rx="2" fill="#eef4ff" />
          <circle cx="0" cy="5.25" r="5.5" fill="none" stroke="#eef4ff" strokeWidth="3.2" />
        </g>
      </svg>
    </section>
  );
}
