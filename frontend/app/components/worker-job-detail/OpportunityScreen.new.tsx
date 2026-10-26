'use client';

/**
 * New opportunity / job-detail (apply flow). Gated by USE_NEW_JOB_DETAIL.
 * Same handlers as legacy OpportunityScreen: accept_suggested + Counter offer route.
 * No saved-jobs heart (concept absent). No requirements section (absent on Opportunity).
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
import { tradeIllustrations } from '../worker-jobs/tradeArt';
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
  const Illustration = tradeIllustrations[o.trade];

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

  const showFacts = true; // estimated_duration + suggested pay always present on Opportunity

  return (
    <main className={`screen ${styles.root}`}>
      <section className={styles.hero} aria-hidden={false}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label={t('Go back')}
        >
          <ArrowLeft size={20} strokeWidth={2.25} aria-hidden />
        </button>
        <div className={styles.heroArt}>
          <Illustration />
        </div>
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

        {showFacts && (
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
        )}

        <section className={styles.block}>
          <h2 className={styles.blockTitle}>{t('What the customer said')}</h2>
          <blockquote className={styles.quote}>“{tx(o.description)}”</blockquote>
          {o.image_id ? (
            <div className={styles.photo}>
              <Photo src={api.imageUrl(o.image_id)} label={t('Customer’s photo')} />
            </div>
          ) : null}
        </section>

        <section className={styles.rows} aria-label={t('Job details')}>
          <div className={styles.row}>
            <span>{t('Urgency')}</span>
            <strong>
              {o.urgency === 'urgent' ? (
                <Chip tone="red" icon={<Clock size={12} />}>{t('Urgent')}</Chip>
              ) : (
                t(capitalise(o.urgency))
              )}
            </strong>
          </div>
          <div className={styles.row}>
            <span>{t('Type of work')}</span>
            <strong>{t(capitalise(o.problem_category.replace(/_/g, ' ')))}</strong>
          </div>
          <div className={styles.row}>
            <span>{t('Difficulty')}</span>
            <strong>{t(capitalise(o.complexity))}</strong>
          </div>
          <div className={styles.row}>
            <span>{t('Price range')}</span>
            <strong>{priceRange}</strong>
          </div>
          <div className={styles.row}>
            <span>{t('Travel')}</span>
            <strong>{money(terms.travel_allowance, terms.currency)}</strong>
          </div>
          <div className={styles.row}>
            <span>{t('Posted')}</span>
            <strong>{when(o.created_at)}</strong>
          </div>
        </section>

        <p className={styles.basis}>{t(terms.basis)}</p>

        {o.limitations.map((l) => (
          <div key={l} className={styles.note}>
            <Note>{t(l)}</Note>
          </div>
        ))}

        {o.has_active_offer && (
          <div className={styles.note}>
            <Note>
              {t(
                'You’ve already sent an offer for this job. The customer will see it with the others.',
              )}
            </Note>
          </div>
        )}

        {Boolean(error) && (
          <div className={styles.note}>
            <ErrorNote error={error} />
          </div>
        )}

        <div className={styles.sticky}>
          {!o.has_active_offer && (
            <button
              type="button"
              className={styles.secondary}
              disabled={saving}
              onClick={onCounter}
            >
              {t('Counter offer')}
            </button>
          )}
          <button
            type="button"
            className={styles.primary}
            disabled={o.has_active_offer || saving}
            onClick={() => void accept()}
          >
            {o.has_active_offer
              ? t('Offer sent')
              : saving
                ? t('Sending…')
                : t('Apply for this job')}
          </button>
          {!o.has_active_offer && (
            <p className={styles.hint}>
              {t('Accept {amount}', { amount: money(terms.suggested_labour_amount) })}
              {' · '}
              {t('You can offer {range} · plus {travel} travel', {
                range: `${money(terms.permitted_min)}–${money(terms.permitted_max)}`,
                travel: money(terms.travel_allowance),
              })}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
