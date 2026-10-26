'use client';

/**
 * Available-for-work row. No optimistic flip — UI follows server state after
 * reload. On API failure the switch stays put (rollback) and onError surfaces it.
 */

import { useState } from 'react';
import { api } from '../../../lib/api';
import { t } from '../../../lib/i18n';
import { AvailabilitySwitch } from '../../AvailabilitySwitch';

interface WorkerAvailabilityRowProps {
  workerId: string;
  available: boolean;
  onChanged: () => void;
  onError?: (err: unknown) => void;
}

export function WorkerAvailabilityRow({
  workerId,
  available,
  onChanged,
  onError,
}: WorkerAvailabilityRowProps) {
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      await api.updateWorker(workerId, {
        availability: available ? 'unavailable' : 'available',
      });
      onChanged();
    } catch (err) {
      onError?.(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wp-avail">
      <div className="wp-avail-text">
        <span className="wp-avail-title">{t('Available for work')}</span>
        <span className="wp-avail-sub">
          {t('Customers nearby can see you and send jobs')}
        </span>
      </div>
      <div className="wp-avail-controls">
        <span className={`wp-online avail-label ${available ? 'on' : ''}`}>
          {available ? t('Online') : t('Offline')}
        </span>
        <AvailabilitySwitch
          on={available}
          disabled={saving}
          onChange={() => void toggle()}
          label={t('Available for work')}
        />
      </div>
    </div>
  );
}
