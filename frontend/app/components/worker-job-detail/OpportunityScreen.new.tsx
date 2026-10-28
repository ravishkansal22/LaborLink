'use client';

/**
 * Opportunity / job-detail (apply flow).
 * Uses real-world photography and Uber/Ola monochrome dark palette.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  IndianRupee,
  MapPin,
} from 'lucide-react';
import { t, tx } from '../../lib/i18n';
import {
  api,
  capitalise,
  hours,
  money,
  tradeNames,
  when,
  type Opportunity,
} from '../../lib/api';
import { Chip, ErrorNote, Note, Photo } from '../ui';
import styles from './OpportunityScreen.new.module.css';

export interface OpportunityScreenNewProps {
  workerId: string;
  opportunity: Opportunity;
  onBack: () => void;
  onCounter: () => void;
  onSent: () => void;
}

export function OpportunityScreenNew({
  workerId,
  opportunity,
  onBack,
  onCounter,
  onSent,
}: OpportunityScreenNewProps) {
  const o = opportunity;
  const terms = o.offer_terms;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.createOffer(o.job_id, { worker_id: workerId, kind: 'accept_suggested' });
      onSent();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const priceRange =
    terms.permitted_min === terms.permitted_max
      ? money(terms.suggested_labour_amount, terms.currency)
      : `${money(terms.permitted_min, terms.currency)}–${money(terms.permitted_max, terms.currency)}`;

  const heroImage = o.image_id
    ? api.imageUrl(o.image_id)
    : `/images/jobs/${o.trade}.jpg`;

  return (
    <main className={`screen ${styles.root}`}>
      <section className={styles.hero} aria-hidden={false}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label={t('Go back')}
        >
          <ArrowLeft size={20} strokeWidth={2.5} aria-hidden />
        </button>
        <img
          src={heroImage}
          alt={t(tradeNames[o.trade].en)}
          className={styles.heroImg}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = `/images/jobs/${o.trade}.jpg`;
          }}
        />
        <div className={styles.heroOverlay} />
      </section>

      <div className={styles.body}>
        <span className={styles.chip}>{t(tradeNames[o.trade].en)}</span>
        <h1 className={styles.title}>{tx(o.problem_summary)}</h1>

        <div className={styles.where}>
          <span className={styles.whereLeft}>
            <MapPin size={14} strokeWidth={2.25} aria-hidden />
            <span className={styles.whereText}>
              {o.distance_km != null
                ? t('{km} km from you', { km: o.distance_km })
                : t('Distance unknown')}
            </span>
          </span>
        </div>

        <div className={styles.facts} role="group" aria-label={t('Job facts')}>
          <div className={styles.fact}>
            <Clock size={16} strokeWidth={1.75} className={styles.factIcon} aria-hidden />
            <strong className={styles.factValue}>
              {t('about {time}', { time: hours(o.estimated_duration) })}
            </strong>
            <span className={styles.factLabel}>{t('Estimated time')}</span>
          </div>
          <span className={styles.factSep} aria-hidden />
          <div className={styles.fact}>
            <IndianRupee size={16} strokeWidth={1.75} className={styles.factIcon} aria-hidden />
            <strong className={styles.factValue}>
              {money(terms.suggested_labour_amount, terms.currency)}
            </strong>
            <span className={styles.factLabel}>{t('Expected pay')}</span>
          </div>
        </div>

        {o.description ? (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('Details')}</h2>
            <p className={styles.description}>{tx(o.description)}</p>
          </div>
        ) : null}

        {o.image_id ? (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('Employer photo')}</h2>
            <Photo src={api.imageUrl(o.image_id)} label={t('Photo of the problem')} />
          </div>
        ) : null}

        <div className={styles.priceCard}>
          <div className={styles.priceRow}>
            <span>{t('Fair price range')}</span>
            <strong>{priceRange}</strong>
          </div>
          <p className={styles.priceNote}>
            {t('You can accept the suggested price of {price} or send a counter offer.', {
              price: money(terms.suggested_labour_amount, terms.currency),
            })}
          </p>
        </div>

        {error ? <ErrorNote error={error} onRetry={accept} /> : null}
      </div>

      <div className={styles.stickyActions}>
        <button
          type="button"
          className={styles.counterBtn}
          onClick={onCounter}
          disabled={saving || o.has_active_offer}
        >
          {t('Counter offer')}
        </button>
        <button
          type="button"
          className={styles.acceptBtn}
          onClick={accept}
          disabled={saving || o.has_active_offer}
        >
          {saving ? t('Sending…') : o.has_active_offer ? t('Offer sent') : t('Accept {price}', { price: money(terms.suggested_labour_amount, terms.currency) })}
        </button>
      </div>
    </main>
  );
}
