'use client';

import {
  BrickWall,
  Hammer,
  MoreHorizontal,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';
import { tradeNames, type Trade } from '../../lib/api';
import styles from './TradeIconRow.module.css';

type TileId = Trade | 'more';

function FaucetIcon({ size = 26, strokeWidth = 1.8, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h7a4 4 0 0 0 4-4V5" />
      <path d="M14 5h4" />
      <path d="M8 8V5" />
      <path d="M6 5h4" />
      <path d="M5 16h2" />
      <path d="M5 12v6" />
      <path d="M7 12v6" />
      <path d="M16 12v2a2 2 0 0 1-2 2h-1" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

interface Tile {
  id: TileId;
  labelEn: string;
  renderIcon: (className: string) => ReactNode;
}

const TILES: Tile[] = [
  {
    id: 'electrician',
    labelEn: tradeNames.electrician.en,
    renderIcon: (cls) => <Zap size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'plumber',
    labelEn: tradeNames.plumber.en,
    renderIcon: (cls) => <FaucetIcon size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'mason',
    labelEn: tradeNames.mason.en,
    renderIcon: (cls) => <BrickWall size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'carpenter',
    labelEn: tradeNames.carpenter.en,
    renderIcon: (cls) => <Hammer size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'more',
    labelEn: 'More',
    renderIcon: (cls) => <MoreHorizontal size={26} strokeWidth={1.8} className={cls} />,
  },
];

interface TradeIconRowProps {
  onSelectTrade: (trade: Trade) => void;
  onMore: () => void;
}

export function TradeIconRow({ onSelectTrade, onMore }: TradeIconRowProps) {
  return (
    <div className={styles.grid} role="list" aria-label={t('Trades')}>
      {TILES.map((tile) => (
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
            {tile.renderIcon(styles.icon)}
          </span>
          <span className={styles.label}>{t(tile.labelEn)}</span>
        </button>
      ))}
    </div>
  );
}
