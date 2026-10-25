'use client';

/**
 * ProfileUserCard
 *
 * Tappable card showing:
 *  - Avatar: uploaded photo OR blue circle with initials (72px)
 *  - Full name (bold, truncated)
 *  - Role chip (blue "Employer" or "Worker")
 *  - Phone icon + masked phone number
 *  - Chevron right
 *
 * onClick → opens Edit Profile (via onOpenEdit callback)
 * Press state: active:scale-[0.98]
 */

import { ChevronRight, Phone } from 'lucide-react';
import { Avatar } from '../ui';
import { t } from '../../lib/i18n';
import type { ProfileData } from './__mocks__';

interface ProfileUserCardProps {
  profile: ProfileData;
  maskedPhone: string;
  onOpenEdit: () => void;
}

export function ProfileUserCard({ profile, maskedPhone, onOpenEdit }: ProfileUserCardProps) {
  const roleLabel = profile.role === 'worker' ? t('Worker') : t('Employer');

  return (
    <button
      type="button"
      className="prof-user-card"
      onClick={onOpenEdit}
      aria-label={t('Edit profile')}
    >
      {/* Avatar */}
      {profile.photoUrl ? (
        <img
          src={profile.photoUrl}
          alt={profile.name}
          className="prof-avatar-photo"
          width={72}
          height={72}
        />
      ) : (
        <Avatar name={profile.name} size={72} />
      )}

      {/* Name + role + phone */}
      <div className="prof-user-info grow">
        <strong className="prof-user-name">{profile.name}</strong>
        <span className="prof-role-chip">{roleLabel}</span>
        <span className="prof-phone-row">
          <Phone size={13} strokeWidth={2} />
          <span>+91 {maskedPhone}</span>
        </span>
      </div>

      {/* Chevron */}
      <ChevronRight size={20} className="muted prof-chevron" />
    </button>
  );
}
