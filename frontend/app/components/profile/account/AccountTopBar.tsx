'use client';

/** Compact settings gear above the name (avatar owns the right of the hero). */

import { Settings } from 'lucide-react';
import { useProfileToast } from '../Toast';
import { t } from '../../../lib/i18n';

export function AccountTopBar() {
  const { show, element: toastEl } = useProfileToast();

  return (
    <div className="acct-topbar">
      {toastEl}
      <button
        type="button"
        className="acct-gear-btn"
        aria-label={t('Settings')}
        onClick={() => show(t('Settings coming soon.'))}
      >
        <Settings size={22} strokeWidth={1.8} />
      </button>
    </div>
  );
}
