'use client';

import { ProfileBottomSheet } from '../BottomSheet';
import { t } from '../../../lib/i18n';

interface ConfirmActionSheetProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Shared confirm sheet for hiring-mode switch and sign-out (phone-framed). */
export function ConfirmActionSheet({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmActionSheetProps) {
  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={title} noHandle>
      <p className="prof-cs-text">{body}</p>
      <div className="wp-confirm-actions">
        <button
          type="button"
          className={danger ? 'btn btn-ghost danger' : 'btn btn-primary'}
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
      </div>
    </ProfileBottomSheet>
  );
}
