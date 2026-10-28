'use client';

import { ArrowRight, Star } from 'lucide-react';
import { t } from '../../../lib/i18n';
import type { Trade } from '../../../lib/api';
import { SectionHeader } from './SectionHeader';
import styles from './JobsNearYou.module.css';

interface JobNearItem {
  id: string;
  trade: Trade;
  title: string;
  location: string;
  distance: string;
  rating: number;
  jobsCount: number;
  rate: string;
  image: string;
}

const NEARBY_JOBS: JobNearItem[] = [
  {
    id: 'nj-1',
    trade: 'electrician',
    title: 'Electrician',
    location: 'RZ Road, Namaste',
    distance: '2.1 km',
    rating: 4.8,
    jobsCount: 124,
    rate: '₹350/hr',
    image: '/images/jobs/electrician.jpg',
  },
  {
    id: 'nj-2',
    trade: 'plumber',
    title: 'Plumber',
    location: 'RZ Road, Namaste',
    distance: '3.4 km',
    rating: 4.7,
    jobsCount: 98,
    rate: '₹400/hr',
    image: '/images/jobs/plumber.jpg',
  },
  {
    id: 'nj-3',
    trade: 'mason',
    title: 'Mason',
    location: 'RZ Road, Namaste',
    distance: '4.2 km',
    rating: 4.6,
    jobsCount: 76,
    rate: '₹300/hr',
    image: '/images/jobs/mason.jpg',
  },
  {
    id: 'nj-4',
    trade: 'carpenter',
    title: 'Carpenter',
    location: 'RZ Road, Namaste',
    distance: '3.1 km',
    rating: 4.9,
    jobsCount: 152,
    rate: '₹450/hr',
    image: '/images/jobs/carpenter.jpg',
  },
];

interface JobsNearYouProps {
  onSelectJob: (trade: Trade) => void;
  onSeeAll?: () => void;
}

export function JobsNearYou({ onSelectJob, onSeeAll }: JobsNearYouProps) {
  return (
    <section aria-label={t('Jobs near you')}>
      <SectionHeader
        title={t('Jobs near you')}
        actionLabel={t('See all')}
        onAction={onSeeAll}
        actionAriaLabel={t('See all jobs near you')}
      />
      <div className={styles.scrollRow} role="list">
        {NEARBY_JOBS.map((job) => (
          <button
            key={job.id}
            type="button"
            role="listitem"
            className={styles.card}
            onClick={() => onSelectJob(job.trade)}
            aria-label={t('{trade} in {location}, {rate}', {
              trade: job.title,
              location: job.location,
              rate: job.rate,
            })}
          >
            <div className={styles.imageWrap}>
              <img
                src={job.image}
                alt={job.title}
                className={styles.jobImage}
                loading="lazy"
              />
              <span className={styles.distanceBadge}>
                {job.distance}
              </span>
            </div>

            <div className={styles.cardBody}>
              <h3 className={styles.jobTitle}>{t(job.title)}</h3>
              <p className={styles.jobLocation}>{job.location}</p>

              <div className={styles.ratingRow}>
                <Star size={13} className={styles.starIcon} fill="currentColor" />
                <span className={styles.ratingScore}>{job.rating.toFixed(1)}</span>
                <span className={styles.jobsCount}>({job.jobsCount} jobs)</span>
              </div>

              <div className={styles.footerRow}>
                <span className={styles.price}>{job.rate}</span>
                <span className={styles.arrowBtn} aria-hidden="true">
                  <ArrowRight size={14} strokeWidth={2.5} />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
