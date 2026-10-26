'use client';

import { Check } from 'lucide-react';
import { allTrades, tradeNames, type Trade } from '../../../lib/api';
import { t } from '../../../lib/i18n';

interface WorkerTradesSectionProps {
  selected: Trade[];
  disabled?: boolean;
  onToggle: (trade: Trade) => void;
}

/** Multi-select trade chips — same minimum-one rule as the legacy screen. */
export function WorkerTradesSection({
  selected,
  disabled,
  onToggle,
}: WorkerTradesSectionProps) {
  return (
    <section className="wp-section" aria-labelledby="wp-trades-label">
      <h3 id="wp-trades-label" className="wp-section-label">{t('Trades')}</h3>
      <div className="wp-chip-wrap">
        {allTrades.map((tr) => {
          const on = selected.includes(tr);
          return (
            <button
              key={tr}
              type="button"
              disabled={disabled}
              className={`wp-chip ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(tr)}
            >
              {on ? <Check size={14} aria-hidden="true" /> : null}
              {t(tradeNames[tr].en)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
