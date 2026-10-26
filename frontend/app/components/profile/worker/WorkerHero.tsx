'use client';

/**
 * Worker account hero — same flat Uber layout as AccountHeader, plus the
 * primary trade · years muted line under the name.
 */

import { Phone } from 'lucide-react';
import { getInitials } from '../../../lib/profile';
import { t } from '../../../lib/i18n';

interface WorkerHeroProps {
  name: string;
  tradeLine: string;
  maskedPhone: string;
  photoUrl?: string;
  onOpenEdit: () => void;
}

export function WorkerHero({
  name,
  tradeLine,
  maskedPhone,
  photoUrl,
  onOpenEdit,
}: WorkerHeroProps) {
  const initials = getInitials(name);

  return (
    <div className="acct-hero-wrap">
      <div className="acct-hero">
        <button
          type="button"
          className="acct-hero-text"
          onClick={onOpenEdit}
          aria-label={t('Edit profile')}
        >
          <h1 className="acct-name">{name}</h1>
          {tradeLine ? <span className="wp-hero-trade">{tradeLine}</span> : null}
          <div className="acct-chips">
            <span className="acct-chip-role">{t('Worker')}</span>
            {maskedPhone && maskedPhone !== '—' ? (
              <span className="acct-chip-phone">
                <Phone size={13} strokeWidth={2} aria-hidden="true" />
                <span>{maskedPhone.startsWith('+') ? maskedPhone : `+91 ${maskedPhone}`}</span>
              </span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          className="acct-avatar-btn"
          onClick={onOpenEdit}
          aria-label={t('Edit profile')}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="acct-avatar-img" width={68} height={68} />
          ) : (
            <span className="acct-avatar-initials" aria-hidden="true">{initials}</span>
          )}
        </button>
      </div>
    </div>
  );
}
