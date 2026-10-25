'use client';

import { t } from '../../../lib/i18n';

const RADII = [2, 5, 10, 15, 25] as const;

interface WorkerRadiusSectionProps {
  valueKm: number;
  disabled?: boolean;
  onSelect: (km: number) => void;
}

/**
 * Work-within chips. Wrap so "25 km" stays visible at 360–430px
 * (legacy `.row` + nowrap + overflow-x:hidden clipped the last chip).
 */
export function WorkerRadiusSection({
  valueKm,
  disabled,
  onSelect,
}: WorkerRadiusSectionProps) {
  return (
    <section className="wp-section" aria-labelledby="wp-radius-label">
      <h3 id="wp-radius-label" className="wp-section-label">{t('Work within')}</h3>
      <div className="wp-radius-wrap" role="radiogroup" aria-label={t('Work within')}>
        {RADII.map((km) => {
          const on = valueKm === km;
          return (
            <button
              key={km}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              className={`wp-radius ${on ? 'on' : ''}`}
              onClick={() => onSelect(km)}
            >
              {km} {t('km')}
            </button>
          );
        })}
      </div>
    </section>
  );
}
