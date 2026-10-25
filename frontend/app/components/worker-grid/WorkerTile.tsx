'use client';

import { t } from '../../lib/i18n';
import type { Trade } from '../../lib/api';
import { WorkerArt } from './illustrations';
import type { WorkerCategory } from './workerCategories';
import styles from './WorkerGrid.module.css';

interface WorkerTileProps {
  category: WorkerCategory;
  index: number;
  onSelect?: (id: Trade) => void;
}

export function WorkerTile({ category, index, onSelect }: WorkerTileProps) {
  const disabled = !onSelect;

  return (
    <button
      type="button"
      className={styles.tile}
      disabled={disabled}
      aria-label={t('Book {label}', { label: category.label })}
      onClick={() => onSelect?.(category.id)}
    >
      {category.badge ? <span className={styles.badge}>{category.badge}</span> : null}
      <span
        className={styles.stage}
        style={{ ['--stage-tint' as string]: category.tint }}
      >
        <WorkerArt
          label={category.label}
          Illustration={category.Illustration}
          imageSrc={category.imageSrc}
          className={styles.art}
          style={{ animationDelay: `${(index % 8) * 0.35}s` }}
        />
      </span>
      <span className={styles.labelEn}>{t(category.label)}</span>
      {category.labelHi ? (
        <span className={styles.labelHi}>{category.labelHi}</span>
      ) : (
        <span className={styles.hiSpacer} aria-hidden="true" />
      )}
    </button>
  );
}
