'use client';

/**
 * Flat soft-tint verify row. Same behaviour as VerifyBanner:
 * hidden when verified; "Verify now" opens an honest coming-soon sheet.
 */

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ProfileBottomSheet } from '../BottomSheet';
import { t } from '../../../lib/i18n';

interface AccountVerifyBannerProps {
  verified?: boolean;
}

export function AccountVerifyBanner({ verified }: AccountVerifyBannerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (verified) return null;

  return (
    <>
      <div className="acct-verify">
        <span className="acct-verify-icon" aria-hidden="true">
          <ShieldCheck size={22} strokeWidth={1.75} />
        </span>
        <p className="acct-verify-text">{t('Verify your profile')}</p>
        <button
          type="button"
          className="acct-verify-btn"
          onClick={() => setSheetOpen(true)}
        >
          {t('Verify now')}
        </button>
      </div>

      <ProfileBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('Verify your profile')}
        noHandle
      >
        <div className="prof-cs-body">
          <span className="prof-cs-icon">
            <ShieldCheck size={32} strokeWidth={1.5} />
          </span>
          <p className="prof-cs-text">
            {t(
              "Verification is coming soon. We'll notify you when you can verify your phone and ID.",
            )}
          </p>
          <button
            type="button"
            className="btn btn-primary mt-12"
            onClick={() => setSheetOpen(false)}
          >
            {t('Okay')}
          </button>
        </div>
      </ProfileBottomSheet>
    </>
  );
}
