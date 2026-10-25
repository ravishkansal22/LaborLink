'use client';

import {
  BrickWall,
  Droplets,
  Hammer,
  MoreHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { currentLanguage, t } from '../../../lib/i18n';
import { tradeNames, type Trade } from '../../../lib/api';
import { SectionHeader } from './SectionHeader';
import styles from './PopularCategories.module.css';

export type CategoryId = Trade | 'more';

interface CategoryDef {
  id: CategoryId;
  /** English label passed through t() / tradeNames. */
  labelEn: string;
  labelHi?: string;
  Icon: LucideIcon;
}

/** Config-driven so adding trades later is a one-line change. */
export const POPULAR_CATEGORIES: CategoryDef[] = [
  { id: 'electrician', labelEn: tradeNames.electrician.en, labelHi: tradeNames.electrician.hi, Icon: Zap },
  { id: 'plumber', labelEn: tradeNames.plumber.en, labelHi: tradeNames.plumber.hi, Icon: Droplets },
  { id: 'mason', labelEn: tradeNames.mason.en, labelHi: tradeNames.mason.hi, Icon: BrickWall },
  { id: 'carpenter', labelEn: tradeNames.carpenter.en, labelHi: tradeNames.carpenter.hi, Icon: Hammer },
  { id: 'more', labelEn: 'More', Icon: MoreHorizontal },
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
  /* WorkerGrid always shows Hindi secondary; 5-col tiles are too tight — show
     Hindi secondary only in English (same idea as the classic 2×2 trade grid). */
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
          const Icon = cat.Icon;
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
                <Icon size={30} strokeWidth={1.75} className={styles.icon} />
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
