'use client';

import { ArrowRight } from 'lucide-react';
import { t } from '../../../lib/i18n';
import styles from './HeroBanner.module.css';

interface HeroBannerProps {
  onBrowseJobs?: () => void;
}

/**
 * Modern Uber/Ola-style Hero Banner featuring authentic real-world photography
 * of skilled tradespeople, crisp typography, and high-contrast white CTA.
 */
export function HeroBanner({ onBrowseJobs }: HeroBannerProps) {
  return (
    <section className={styles.banner} aria-label={t('Skilled workers. Right when you need them.')}>
      <div className={styles.copy}>
        <h2 className={styles.headline}>
          {t('Skilled workers.')}<br />
          {t('Right when you need them.')}
        </h2>
        <p className={styles.sub}>
          {t('Verified • Reliable • Local')}
        </p>
        <button
          type="button"
          className={styles.ctaBtn}
          onClick={onBrowseJobs}
          aria-label={t('Browse jobs')}
        >
          <span>{t('Browse jobs')}</span>
          <ArrowRight size={15} strokeWidth={2.5} />
        </button>
      </div>

      <div className={styles.imageContainer}>
        <img
          src="/images/hero-worker.jpg"
          alt={t('Skilled worker with yellow hard hat at construction site')}
          className={styles.heroImage}
        />
        <div className={styles.imageOverlay} />
      </div>

      <div className={styles.dots} aria-hidden="true">
        <span className={`${styles.dot} ${styles.dotActive}`} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </section>
  );
}
