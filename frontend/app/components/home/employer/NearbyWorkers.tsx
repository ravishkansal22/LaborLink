'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api, tradeNames, type Trade } from '../../../lib/api';
import { useLocation } from '../../../lib/location/LocationContext';
import { t } from '../../../lib/i18n';
import { SectionHeader } from './SectionHeader';
import styles from './NearbyWorkers.module.css';

interface WorkerItem {
  id: string;
  display_name: string;
  trades: Trade[];
  years_experience: number | null;
  distance_km: number;
}

interface NearbyWorkersProps {
  onDescribeJob: (trade?: Trade) => void;
  onViewAll: () => void;
}

export function NearbyWorkers({ onDescribeJob, onViewAll }: NearbyWorkersProps) {
  const { selected, current } = useLocation();
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState(false);

  const lat = selected?.lat ?? current?.coords.lat;
  const lon = selected?.lng ?? current?.coords.lng;

  useEffect(() => {
    if (lat == null || lon == null) return;
    setLoading(true);
    api.nearbyWorkers({ lat, lon, radius_km: 25 })
      .then((res) => setWorkers(res.items))
      .catch(() => setWorkers([]))
      .finally(() => setLoading(false));
  }, [lat, lon]);

  return (
    <section aria-label={t('Workers near you')}>
      <SectionHeader
        title={t('Workers near you')}
        actionLabel={t('View all')}
        onAction={onViewAll}
        actionAriaLabel={t('View all')}
      />

      {workers.length > 0 ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {workers.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onDescribeJob(w.trades[0])}
              style={{
                flex: '0 0 200px',
                padding: 14,
                borderRadius: 16,
                border: '1px solid var(--pf-border, #e5e7eb)',
                background: 'var(--pf-surface, #fff)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--pf-text, #111827)' }}>
                {w.display_name}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                {w.trades.map((tr) => t(tradeNames[tr]?.en ?? tr)).join(', ')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--pf-brand, #2563eb)', marginTop: 8 }}>
                {w.distance_km} km away {w.years_experience ? `· ${w.years_experience} yrs exp` : ''}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className={styles.empty}
          onClick={() => onDescribeJob()}
          aria-label={t('Describe a new job')}
        >
          <span className={styles.emptyIcon} aria-hidden>
            <Users size={22} strokeWidth={1.75} />
          </span>
          <span className={styles.emptyBody}>
            <strong className={styles.emptyTitle}>
              {loading ? t('Searching nearby workers…') : t('Workers near you will appear here')}
            </strong>
            <span className={styles.emptyText}>
              {t('Describe a job to get offers from workers nearby.')}
            </span>
          </span>
        </button>
      )}
    </section>
  );
}