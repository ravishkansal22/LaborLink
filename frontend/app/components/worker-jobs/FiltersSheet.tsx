'use client';

/**
 * Find-work filters: only controls backed by real Opportunity / Worker fields.
 * - Trade multi-select (Opportunity.trade)
 * - Max distance ≤ worker service_radius_km (Opportunity.distance_km)
 * - Radius options PATCH worker.service_radius_km (same as legacy Find work)
 */

import { useEffect, useState } from 'react';
import { t } from '../../lib/i18n';
import { allTrades, tradeNames, type Trade } from '../../lib/api';
import { ProfileBottomSheet } from '../profile/BottomSheet';
import styles from './FiltersSheet.module.css';

const RADIUS_OPTIONS = [2, 5, 10, 15, 25] as const;

export interface FindWorkFilters {
  trades: Trade[];
  /** Client-side max distance filter; null = no extra filter beyond fetched set. */
  maxDistanceKm: number | null;
}

interface FiltersSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FindWorkFilters;
  onChangeFilters: (next: FindWorkFilters) => void;
  serviceRadiusKm: number;
  onChangeRadius: (km: number) => void;
  radiusSaving: boolean;
}

export function FiltersSheet({
  open,
  onClose,
  filters,
  onChangeFilters,
  serviceRadiusKm,
  onChangeRadius,
  radiusSaving,
}: FiltersSheetProps) {
  const [draft, setDraft] = useState<FindWorkFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const toggleTrade = (trade: Trade) => {
    setDraft((prev) => {
      const has = prev.trades.includes(trade);
      return {
        ...prev,
        trades: has ? prev.trades.filter((tr) => tr !== trade) : [...prev.trades, trade],
      };
    });
  };

  const apply = () => {
    onChangeFilters(draft);
    onClose();
  };

  const clear = () => {
    const empty: FindWorkFilters = { trades: [], maxDistanceKm: null };
    setDraft(empty);
    onChangeFilters(empty);
    onClose();
  };

  const distanceOptions = RADIUS_OPTIONS.filter((km) => km <= serviceRadiusKm);

  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={t('Filters')}>
      <div className={styles.body}>
        <p className={styles.label}>{t('Trade')}</p>
        <div className={styles.chips} role="group" aria-label={t('Trade')}>
          {allTrades.map((tr) => {
            const on = draft.trades.includes(tr);
            return (
              <button
                key={tr}
                type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                aria-pressed={on}
                onClick={() => toggleTrade(tr)}
              >
                {t(tradeNames[tr].en)}
              </button>
            );
          })}
        </div>

        <p className={styles.label}>{t('Within')}</p>
        <div className={styles.chips} role="group" aria-label={t('Work radius')}>
          {RADIUS_OPTIONS.map((km) => (
            <button
              key={km}
              type="button"
              disabled={radiusSaving}
              className={`${styles.chip} ${serviceRadiusKm === km ? styles.chipOn : ''}`}
              aria-pressed={serviceRadiusKm === km}
              onClick={() => onChangeRadius(km)}
            >
              {km} {t('km')}
            </button>
          ))}
        </div>

        {distanceOptions.length > 0 && (
          <>
            <p className={styles.label}>{t('Max distance')}</p>
            <div className={styles.chips} role="group" aria-label={t('Max distance')}>
              <button
                type="button"
                className={`${styles.chip} ${draft.maxDistanceKm == null ? styles.chipOn : ''}`}
                aria-pressed={draft.maxDistanceKm == null}
                onClick={() => setDraft((p) => ({ ...p, maxDistanceKm: null }))}
              >
                {t('Any')}
              </button>
              {distanceOptions.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={`${styles.chip} ${draft.maxDistanceKm === km ? styles.chipOn : ''}`}
                  aria-pressed={draft.maxDistanceKm === km}
                  onClick={() => setDraft((p) => ({ ...p, maxDistanceKm: km }))}
                >
                  {km} {t('km')}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.clear} onClick={clear}>
            {t('Clear filters')}
          </button>
          <button type="button" className={styles.apply} onClick={apply}>
            {t('Apply filters')}
          </button>
        </div>
      </div>
    </ProfileBottomSheet>
  );
}
