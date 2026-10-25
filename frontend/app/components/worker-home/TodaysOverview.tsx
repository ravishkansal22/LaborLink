'use client';

import { Activity, CircleCheck, Ruler } from 'lucide-react';
import { t } from '../../lib/i18n';
import styles from './TodaysOverview.module.css';

interface TodaysOverviewProps {
  completedJobs: number;
  activeJobs: number;
  radiusKm: number;
}

export function TodaysOverview({
  completedJobs,
  activeJobs,
  radiusKm,
}: TodaysOverviewProps) {
  const cells = [
    {
      key: 'done',
      Icon: CircleCheck,
      value: String(completedJobs),
      label: t('Jobs completed'),
    },
    {
      key: 'active',
      Icon: Activity,
      value: String(activeJobs),
      label: t('Active now'),
    },
    {
      key: 'radius',
      Icon: Ruler,
      value: `${radiusKm} ${t('km')}`,
      label: t('Work radius'),
    },
  ] as const;

  return (
    <section className={styles.wrap} aria-label={t("Today's overview")}>
      <h2 className={styles.heading}>{t("Today's overview")}</h2>
      <div className={styles.strip}>
        {cells.map(({ key, Icon, value, label }, i) => (
          <div key={key} className={styles.cell}>
            {i > 0 ? <span className={styles.sep} aria-hidden /> : null}
            <div className={styles.inner}>
              <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
              <strong className={styles.value}>{value}</strong>
              <span className={styles.label}>{label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
