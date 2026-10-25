'use client';

/**
 * VerifyBanner
 *
 * Soft-blue card prompting profile verification.
 * - Hides entirely when profile.verified is true.
 * - "Verify now" button opens a BottomSheet with an honest "Coming soon" message.
 * - Does NOT mark anything as verified (rule 6).
 */

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ProfileBottomSheet } from './BottomSheet';
import { t } from '../../lib/i18n';

interface VerifyBannerProps {
  verified?: boolean;
}

export function VerifyBanner({ verified }: VerifyBannerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (verified) return null;

  return (
    <>
      <div className="prof-verify-card">
        <div className="prof-verify-icon-wrap">
          <ShieldCheck size={22} strokeWidth={1.8} />
        </div>
        <div className="grow">
          <p className="prof-verify-title">{t('Verify your profile')}</p>
          <p className="prof-verify-body">
            {t('Build trust and get better matches with verified details.')}
          </p>
        </div>
        <button
          type="button"
          className="prof-verify-btn"
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
              'Verification is coming soon. We\'ll notify you when you can verify your phone and ID.',
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
