'use client';

/**
 * Compact opportunity card shared by Worker Home and Find work.
 * Uses real-world authentic photography instead of cartoonish illustrations.
 */

import { t, tx } from '../../lib/i18n';
import { api, money, tradeNames, type Opportunity } from '../../lib/api';
import styles from './JobCard.module.css';

export interface JobCardProps {
  item: Opportunity;
  /** Card body → existing opportunity / job-detail route. */
  onOpen: () => void;
  /** Apply → existing send-offer flow (same opportunity screen today). */
  onApply: () => void;
  /** Wider card for horizontal snap rows (~85% width). */
  snap?: boolean;
}

export function JobCard({ item, onOpen, onApply, snap = false }: JobCardProps) {
  const terms = item.offer_terms;
  const priceLabel =
    terms.permitted_min === terms.permitted_max
      ? money(terms.suggested_labour_amount, terms.currency)
      : `${money(terms.permitted_min, terms.currency)}–${money(terms.permitted_max, terms.currency)}`;

  const imageSrc = item.image_id
    ? api.imageUrl(item.image_id)
    : `/images/jobs/${item.trade}.jpg`;

  return (
    <article className={`${styles.card} ${snap ? styles.snap : ''}`}>
      <button
        type="button"
        className={styles.body}
        onClick={onOpen}
        aria-label={tx(item.problem_summary) || t(tradeNames[item.trade].en)}
      >
        <span className={styles.art} aria-hidden="true">
          <img
            src={imageSrc}
            alt=""
            className={styles.jobThumb}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `/images/jobs/${item.trade}.jpg`;
            }}
          />
        </span>
        <span className={styles.meta}>
          <span className={styles.chip}>{t(tradeNames[item.trade].en)}</span>
          <strong className={styles.title}>{tx(item.problem_summary)}</strong>
          <span className={styles.facts}>
            {item.distance_km != null
              ? t('{km} km away', { km: item.distance_km })
              : t('distance unknown')}
            {' · '}
            {priceLabel}
          </span>
        </span>
      </button>
      <button
        type="button"
        className={styles.apply}
        onClick={(e) => {
          e.stopPropagation();
          onApply();
        }}
        disabled={item.has_active_offer}
      >
        {item.has_active_offer ? t('Offer sent') : t('Apply')}
      </button>
    </article>
  );
}
