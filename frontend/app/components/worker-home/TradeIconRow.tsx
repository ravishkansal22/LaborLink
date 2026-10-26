'use client';

import {
  BrickWall,
  Droplets,
  Hammer,
  MoreHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { t } from '../../lib/i18n';
import { tradeNames, type Trade } from '../../lib/api';
import styles from './TradeIconRow.module.css';

type TileId = Trade | 'more';

interface Tile {
  id: TileId;
  labelEn: string;
  Icon: LucideIcon;
}

const TILES: Tile[] = [
  { id: 'electrician', labelEn: tradeNames.electrician.en, Icon: Zap },
  { id: 'plumber', labelEn: tradeNames.plumber.en, Icon: Droplets },
  { id: 'mason', labelEn: tradeNames.mason.en, Icon: BrickWall },
  { id: 'carpenter', labelEn: tradeNames.carpenter.en, Icon: Hammer },
  { id: 'more', labelEn: 'More', Icon: MoreHorizontal },
];

interface TradeIconRowProps {
  onSelectTrade: (trade: Trade) => void;
  onMore: () => void;
}

export function TradeIconRow({ onSelectTrade, onMore }: TradeIconRowProps) {
  return (
    <div className={styles.grid} role="list" aria-label={t('Trades')}>
      {TILES.map((tile) => {
        const Icon = tile.Icon;
        return (
          <button
            key={tile.id}
            type="button"
            role="listitem"
            className={styles.item}
            onClick={() => {
              if (tile.id === 'more') onMore();
              else onSelectTrade(tile.id);
            }}
            aria-label={tile.id === 'more' ? t('More') : t(tile.labelEn)}
          >
            <span className={styles.tile} aria-hidden>
              <Icon size={28} strokeWidth={1.75} />
            </span>
            <span className={styles.label}>{t(tile.labelEn)}</span>
          </button>
        );
      })}
    </div>
  );
}
