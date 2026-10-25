'use client';

import { t } from '../../../lib/i18n';
import styles from './HeroBanner.module.css';

/**
 * Decorative hero — CSS/SVG only, no network images.
 * Not tappable: describe-job already has a primary control above.
 */
export function HeroBanner() {
  return (
    <section className={styles.banner} aria-label={t('Skilled workers. Right when you need them.')}>
      <div className={styles.copy}>
        <p className={styles.headline}>
          {t('Skilled workers. Right when you need them.')}
        </p>
        <p className={styles.sub}>
          {t('Local • On demand • Fair prices')}
        </p>
      </div>
      <svg
        className={styles.art}
        viewBox="0 0 120 120"
        width="112"
        height="112"
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id="ehHardHat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8eb6ff" />
            <stop offset="100%" stopColor="#3d7ef0" />
          </linearGradient>
          <linearGradient id="ehBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c5d8ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#6b9fff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* Soft glow disc */}
        <circle cx="62" cy="64" r="46" fill="#1a3a8a" opacity="0.35" />
        {/* Shoulders / torso */}
        <path
          d="M28 108c6-28 22-42 34-42s28 14 34 42"
          fill="url(#ehBody)"
        />
        {/* Head */}
        <circle cx="62" cy="48" r="16" fill="#d7e4ff" opacity="0.9" />
        {/* Hard hat */}
        <path
          d="M38 48c2-16 12-24 24-24s22 8 24 24H38z"
          fill="url(#ehHardHat)"
        />
        <ellipse cx="62" cy="48" rx="28" ry="5" fill="#a8c4ff" />
        {/* Small wrench accent */}
        <g transform="translate(88 72) rotate(28)" opacity="0.85">
          <rect x="0" y="4" width="22" height="5" rx="2" fill="#e8f0ff" />
          <circle cx="0" cy="6.5" r="6" fill="none" stroke="#e8f0ff" strokeWidth="3.5" />
        </g>
      </svg>
    </section>
  );
}
