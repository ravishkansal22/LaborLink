'use client';

/**
 * Same Online/Offline label + AvailabilitySwitch + api.updateWorker behaviour
 * as screens/worker.tsx OnlineSwitch (no optimistic flip; reload on success).
 */

import { useState } from 'react';
import { api } from '../../lib/api';
import { t } from '../../lib/i18n';
import { AvailabilitySwitch } from '../AvailabilitySwitch';

export function OnlineSwitchRow({
  workerId,
  available,
  onChanged,
}: {
  workerId: string;
  available: boolean;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => {
    setSaving(true);
    try {
      await api.updateWorker(workerId, {
        availability: available ? 'unavailable' : 'available',
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span className={`online avail-label ${available ? 'on' : ''}`}>
        {available ? t('Online') : t('Offline')}
      </span>
      <AvailabilitySwitch
        on={available}
        disabled={saving}
        onChange={() => void toggle()}
        label={t('Available for work')}
      />
    </>
  );
}
