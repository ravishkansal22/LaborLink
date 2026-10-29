'use client';

import {
  BrickWall,
  Hammer,
  MoreHorizontal,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { currentLanguage, t } from '../../../lib/i18n';
import { tradeNames, type Trade } from '../../../lib/api';
import { SectionHeader } from './SectionHeader';
import styles from './PopularCategories.module.css';

export type CategoryId = Trade | 'more';

/** Clean line SVG faucet/pipe icon for Plumber matching Uber/Ola modern iconography */
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

interface CategoryDef {
  id: CategoryId;
  labelEn: string;
  labelHi?: string;
  renderIcon: (className: string) => ReactNode;
}

export const POPULAR_CATEGORIES: CategoryDef[] = [
  {
    id: 'electrician',
    labelEn: tradeNames.electrician.en,
    labelHi: tradeNames.electrician.hi,
    renderIcon: (cls) => <Zap size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'plumber',
    labelEn: tradeNames.plumber.en,
    labelHi: tradeNames.plumber.hi,
    renderIcon: (cls) => <FaucetIcon size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'mason',
    labelEn: tradeNames.mason.en,
    labelHi: tradeNames.mason.hi,
    renderIcon: (cls) => <BrickWall size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'carpenter',
    labelEn: tradeNames.carpenter.en,
    labelHi: tradeNames.carpenter.hi,
    renderIcon: (cls) => <Hammer size={26} strokeWidth={1.8} className={cls} />,
  },
  {
    id: 'more',
    labelEn: 'More',
    renderIcon: (cls) => <MoreHorizontal size={26} strokeWidth={1.8} className={cls} />,
  },
];

interface PopularCategoriesProps {
  onSelectTrade: (trade: Trade) => void;
  onMore: () => void;
  onViewAll: () => void;
}

export function PopularCategories({
  onSelectTrade,
  onMore,
  onViewAll,
}: PopularCategoriesProps) {
  const showHiSecondary = currentLanguage() === 'en';

  return (
    <section aria-label={t('Popular categories')}>
      <SectionHeader
        title={t('Popular categories')}
        actionLabel={t('View all')}
        onAction={onViewAll}
        actionAriaLabel={t('View all')}
      />
      <div className={styles.grid}>
        {POPULAR_CATEGORIES.map((cat) => {
          const isMore = cat.id === 'more';
          const label = t(cat.labelEn);
          const onClick = () => {
            if (cat.id === 'more') onMore();
            else onSelectTrade(cat.id);
          };
          return (
            <button
              key={cat.id}
              type="button"
              className={styles.item}
              onClick={onClick}
              aria-label={isMore ? t('More') : t('Book {label}', { label: cat.labelEn })}
            >
              <span className={styles.tile} aria-hidden>
                {cat.renderIcon(styles.icon)}
              </span>
              <span className={styles.label}>{label}</span>
              {showHiSecondary && cat.labelHi ? (
                <span className={styles.labelHi}>{cat.labelHi}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
