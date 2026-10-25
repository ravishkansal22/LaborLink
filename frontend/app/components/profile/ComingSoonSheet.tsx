'use client';

/**
 * ComingSoonSheet
 *
 * Reusable "Coming soon" bottom sheet used by Payments, Help, Safety, Notifications.
 * Shows an honest, clearly-labelled placeholder — no fake functionality.
 */

import { Clock } from 'lucide-react';
import { ProfileBottomSheet } from './BottomSheet';
import { t } from '../../lib/i18n';

interface ComingSoonSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

export function ComingSoonSheet({ open, title, onClose }: ComingSoonSheetProps) {
  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={title} noHandle>
      <div className="prof-cs-body">
        <span className="prof-cs-icon">
          <Clock size={32} strokeWidth={1.5} />
        </span>
        <p className="prof-cs-text">
          {t('{section} is coming soon.', { section: title })}
        </p>
        <button
          type="button"
          className="btn btn-primary mt-12"
          onClick={onClose}
        >
          {t('Got it')}
        </button>
      </div>
    </ProfileBottomSheet>
  );
}
