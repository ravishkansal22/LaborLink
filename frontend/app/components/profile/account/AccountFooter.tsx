'use client';

import { LogOut } from 'lucide-react';
import { t } from '../../../lib/i18n';

interface AccountFooterProps {
  onSignOut: () => void;
  employerId: string;
}

export function AccountFooter({ onSignOut, employerId }: AccountFooterProps) {
  return (
    <div className="acct-footer">
      <button
        type="button"
        className="acct-signout"
        onClick={onSignOut}
        aria-label={t('Sign out of this phone')}
      >
        <LogOut size={17} aria-hidden="true" />
        {t('Sign out of this phone')}
      </button>
      <p className="acct-employer-id">
        {t('Employer ID')} {employerId}
      </p>
    </div>
  );
}
