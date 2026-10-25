'use client';

/**
 * ProfileHeader
 *
 * Top section of the Profile screen:
 *  - "LaborLink" wordmark (left, bold navy, wordmark class from globals.css)
 *  - Gear icon button (right, 44×44 tap target, aria-label "Settings")
 *    → shows a "Settings coming soon" toast inside the phone frame
 *    (no settings screen exists yet – rule 6)
 *  - "Profile" title below (h1, same weight/size as .h1 class)
 */

import { Settings } from 'lucide-react';
import { useProfileToast } from './Toast';
import { t } from '../../lib/i18n';

interface ProfileHeaderProps {
  /** Called when Edit Profile should open (reserved for future sheet/nav) */
  onOpenEdit?: () => void;
}

// onOpenEdit is reserved for future use (e.g. if gear navigates to edit).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProfileHeader({ onOpenEdit: _onOpenEdit }: ProfileHeaderProps) {
  const { show, element: toastEl } = useProfileToast();

  return (
    <div className="prof-header">
      {toastEl}
      <div className="prof-header-bar">
        <span className="wordmark prof-wordmark" aria-label="LaborLink">LaborLink</span>
        <button
          type="button"
          className="prof-gear-btn"
          aria-label={t('Settings')}
          onClick={() => show(t('Settings coming soon.'))}
        >
          <Settings size={22} strokeWidth={1.8} />
        </button>
      </div>
      <h1 className="h1 prof-title">{t('Profile')}</h1>
    </div>
  );
}
