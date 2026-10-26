'use client';

import { Info, LogOut } from 'lucide-react';
import { t } from '../../../lib/i18n';

interface WorkerFooterProps {
  workerIdShort: string;
  onSignOutPress: () => void;
}

export function WorkerFooter({ workerIdShort, onSignOutPress }: WorkerFooterProps) {
  return (
    <div className="wp-footer">
      <button
        type="button"
        className="wp-signout"
        onClick={onSignOutPress}
        aria-label={t('Sign out of this phone')}
      >
        <LogOut size={17} aria-hidden="true" />
        {t('Sign out of this phone')}
      </button>
      <p className="wp-id">
        <Info size={12} aria-hidden="true" />
        {t('Worker ID')} {workerIdShort}
      </p>
    </div>
  );
}
