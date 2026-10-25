'use client';

import { t } from '../../lib/i18n';
import { allTrades, tradeNames, type Trade } from '../../lib/api';
import styles from './TradeChips.module.css';

export type TradeChipId = Trade | 'all';

interface TradeChipsProps {
  value: TradeChipId;
  onChange: (id: TradeChipId) => void;
}

export function TradeChips({ value, onChange }: TradeChipsProps) {
  const items: Array<{ id: TradeChipId; label: string }> = [
    { id: 'all', label: t('All') },
    ...allTrades.map((tr) => ({ id: tr as TradeChipId, label: t(tradeNames[tr].en) })),
  ];

  return (
    <div className={styles.row} role="tablist" aria-label={t('Filter by trade')}>
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.chip} ${selected ? styles.on : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
