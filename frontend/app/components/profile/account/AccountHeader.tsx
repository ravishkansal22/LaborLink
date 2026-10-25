'use client';

/**
 * Account hero: uppercase display name (CSS only) + avatar + muted chips.
 * Name block and avatar both open Edit Profile.
 */

import { Phone } from 'lucide-react';
import { t } from '../../../lib/i18n';

interface AccountHeaderProps {
  name: string;
  role: 'employer' | 'worker';
  maskedPhone: string;
  photoUrl?: string;
  /** Real rating only — omit when undefined (no fake stars). */
  rating?: number;
  onOpenEdit: () => void;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.map((p) => p[0] ?? '').join('');
  return letters.slice(0, 2).toUpperCase() || '?';
}

export function AccountHeader({
  name,
  role,
  maskedPhone,
  photoUrl,
  rating,
  onOpenEdit,
}: AccountHeaderProps) {
  const roleLabel = role === 'worker' ? t('Worker') : t('Employer');
  const initials = initialsFromName(name);

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
          <div className="acct-chips">
            <span className="acct-chip-role">{roleLabel}</span>
            <span className="acct-chip-phone">
              <Phone size={13} strokeWidth={2} aria-hidden="true" />
              <span>+91 {maskedPhone}</span>
            </span>
            {typeof rating === 'number' ? (
              <span className="acct-chip-phone" aria-label={`Rating ${rating.toFixed(1)}`}>
                ★ {rating.toFixed(1)}
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
