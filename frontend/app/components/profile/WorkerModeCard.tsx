'use client';

/**
 * WorkerModeCard
 *
 * Soft-blue card with helmet icon, descriptive text, and an outlined
 * "Switch to worker mode ›" button.
 *
 * Calls the EXISTING onWorkerMode handler (toWorker in page.tsx).
 * Any confirmation logic already embedded in that handler is preserved.
 */

import { HardHat } from 'lucide-react';
import { t } from '../../lib/i18n';

interface WorkerModeCardProps {
  onWorkerMode: () => void;
}

export function WorkerModeCard({ onWorkerMode }: WorkerModeCardProps) {
  return (
    <div className="prof-worker-card">
      <div className="prof-worker-icon">
        <HardHat size={26} strokeWidth={1.6} />
      </div>
      <div className="grow">
        <p className="prof-worker-title">{t('Looking for work too?')}</p>
        <p className="prof-worker-body">
          {t('Switch to worker mode to find nearby job opportunities.')}
        </p>
        <button
          type="button"
          className="prof-worker-btn"
          onClick={onWorkerMode}
        >
          {t('Switch to worker mode')} ›
        </button>
      </div>
    </div>
  );
}
