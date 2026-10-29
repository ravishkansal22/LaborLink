'use client';

import { ArrowRight } from 'lucide-react';
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
        <h2 className={styles.headline}>{t('Skilled work. Real opportunities.')}</h2>
        <p className={styles.sub}>
          {t('Find jobs in your area and send your price.')}
        </p>
        <button type="button" className={styles.cta} onClick={onBrowseJobs} aria-label={t('Browse Jobs')}>
          <span>{t('Browse Jobs')}</span>
          <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>

      <div className={styles.imageContainer}>
        <img
          src="/images/hero-worker.jpg"
          alt={t('Skilled worker')}
          className={styles.heroImage}
        />
        <div className={styles.imageOverlay} />
      </div>
    </section>
  );
}
