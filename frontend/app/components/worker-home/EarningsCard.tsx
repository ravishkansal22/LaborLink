'use client';

import { ChevronRight } from 'lucide-react';
import { t } from '../../lib/i18n';
import { money } from '../../lib/api';
import styles from './EarningsCard.module.css';

interface EarningsCardProps {
  currency: string;
  confirmedEarnings: number;
  paidDemo: number;
  pendingCount: number;
  pendingAmount: number;
  onOpenPassbook: () => void;
}

export function EarningsCard({
  currency,
  confirmedEarnings,
  paidDemo,
  pendingCount,
  pendingAmount,
  onOpenPassbook,
}: EarningsCardProps) {
  return (
    <section className={styles.card} aria-label={t('Confirmed earnings')}>
      <p className={styles.label}>{t('Confirmed earnings')}</p>
      <strong className={styles.amount}>{money(confirmedEarnings, currency)}</strong>
      <div className={styles.split}>
        <span>
          <small>{t('Paid (demo)')}</small>
          {money(paidDemo, currency)}
        </span>
        <span>
          <small>
            {t('Payment pending')} · {pendingCount}
          </small>
          {money(pendingAmount, currency)}
        </span>
      </div>
      <button type="button" className={styles.link} onClick={onOpenPassbook}>
        {t('Open Kamai Passbook')} <ChevronRight size={16} aria-hidden />
      </button>
    </section>
  );
}
