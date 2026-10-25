'use client';

/**
 * SignOutFooter
 *
 * Centred "Sign out of this phone" button (red, with LogOut icon)
 * calling the EXISTING onSignOut handler.
 * Below it: the Employer ID line, muted, as today.
 */

import { LogOut } from 'lucide-react';
import { t } from '../../lib/i18n';

interface SignOutFooterProps {
  onSignOut: () => void;
  employerId: string;
}

export function SignOutFooter({ onSignOut, employerId }: SignOutFooterProps) {
  return (
    <div className="prof-footer">
      <button
        type="button"
        className="btn btn-ghost danger prof-signout-btn"
        onClick={onSignOut}
        aria-label={t('Sign out of this phone')}
      >
        <LogOut size={17} aria-hidden="true" />
        {t('Sign out of this phone')}
      </button>
      <p className="small center prof-employer-id">
        {t('Employer ID')} {employerId}
      </p>
    </div>
  );
}
