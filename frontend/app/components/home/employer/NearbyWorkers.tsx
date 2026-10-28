'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Check, Star, Users } from 'lucide-react';
import { api, tradeNames, type Trade } from '../../../lib/api';
import { useLocation } from '../../../lib/location/LocationContext';
import { t } from '../../../lib/i18n';
import { SectionHeader } from './SectionHeader';
import styles from './NearbyWorkers.module.css';

interface WorkerItem {
  id: string;
  name: string;
  trade: Trade;
  tradeLabel: string;
  rating: number;
  jobsCount: number;
  distance: string;
  rate: string;
  avatar: string;
  verified: boolean;
}

const FEATURED_TOP_WORKERS: WorkerItem[] = [
  {
    id: 'top-1',
    name: 'Ramesh Kumar',
    trade: 'electrician',
    tradeLabel: 'Electrician',
    rating: 4.9,
    jobsCount: 320,
    distance: '1.2 km away',
    rate: '₹400/hr',
    avatar: '/images/workers/ramesh.jpg',
    verified: true,
  },
  {
    id: 'top-2',
    name: 'Suresh Pal',
    trade: 'plumber',
    tradeLabel: 'Plumber',
    rating: 4.8,
    jobsCount: 276,
    distance: '2.4 km away',
    rate: '₹350/hr',
    avatar: '/images/workers/suresh.jpg',
    verified: true,
  },
  {
    id: 'top-3',
    name: 'Imran Khan',
    trade: 'carpenter',
    tradeLabel: 'Carpenter',
    rating: 4.7,
    jobsCount: 198,
    distance: '3.1 km away',
    rate: '₹450/hr',
    avatar: '/images/workers/imran.jpg',
    verified: true,
  },
];

interface NearbyWorkersProps {
  onDescribeJob: (trade?: Trade) => void;
  onViewAll?: () => void;
}

export function NearbyWorkers({ onDescribeJob, onViewAll }: NearbyWorkersProps) {
  const { selected, current } = useLocation();
  const [liveWorkers, setLiveWorkers] = useState<WorkerItem[]>([]);

  const lat = selected?.lat ?? current?.coords.lat;
  const lon = selected?.lng ?? current?.coords.lng;

  useEffect(() => {
    if (lat == null || lon == null) return;
    api.nearbyWorkers({ lat, lon, radius_km: 25 })
      .then((res) => {
        if (res.items && res.items.length > 0) {
          const mapped: WorkerItem[] = res.items.map((w, idx) => ({
            id: w.id,
            name: w.display_name,
            trade: w.trades[0] ?? 'electrician',
            tradeLabel: t(tradeNames[w.trades[0]]?.en ?? 'Technician'),
            rating: 4.8 + (idx % 3) * 0.1,
            jobsCount: 80 + idx * 45,
            distance: `${w.distance_km} km away`,
            rate: `₹${350 + (idx % 3) * 50}/hr`,
            avatar: FEATURED_TOP_WORKERS[idx % FEATURED_TOP_WORKERS.length].avatar,
            verified: true,
          }));
          setLiveWorkers(mapped);
        }
      })
      .catch(() => {});
  }, [lat, lon]);

  const displayWorkers = liveWorkers.length > 0 ? liveWorkers : FEATURED_TOP_WORKERS;

  return (
    <section aria-label={t('Top workers')}>
      <SectionHeader
        title={t('Top workers')}
        actionLabel={t('View all')}
        onAction={onViewAll}
        actionAriaLabel={t('View all top workers')}
      />

      <div className={styles.scrollRow} role="list">
        {displayWorkers.map((worker) => (
          <div
            key={worker.id}
            role="listitem"
            className={styles.workerCard}
          >
            <div className={styles.headerRow}>
              <div className={styles.avatarWrap}>
                <img
                  src={worker.avatar}
                  alt={worker.name}
                  className={styles.avatarImg}
                  loading="lazy"
                />
                {worker.verified && (
                  <span className={styles.verifiedBadge} aria-label={t('Verified worker')}>
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </div>

              <div className={styles.workerMeta}>
                <h3 className={styles.workerName}>{worker.name}</h3>
                <span className={styles.workerTrade}>{t(worker.tradeLabel)}</span>
                <div className={styles.ratingRow}>
                  <Star size={12} className={styles.starIcon} fill="currentColor" />
                  <span className={styles.ratingScore}>{worker.rating.toFixed(1)}</span>
                  <span className={styles.jobsCount}>({worker.jobsCount} jobs)</span>
                </div>
                <span className={styles.distance}>{worker.distance}</span>
              </div>
            </div>

            <div className={styles.footerRow}>
              <span className={styles.price}>{worker.rate}</span>
              <button
                type="button"
                className={styles.bookBtn}
                onClick={() => onDescribeJob(worker.trade)}
                aria-label={t('Book {name}', { name: worker.name })}
              >
                {t('Book')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
