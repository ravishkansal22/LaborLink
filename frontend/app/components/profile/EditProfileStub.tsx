'use client';

/**
 * EditProfileStub – full-screen stub page for Edit Profile.
 *
 * This is a placeholder until the Edit Profile feature is built in the next prompt.
 * It fills the phone frame, has a back button (AppBar), and notes which field
 * would be focused when opened from ProfileCompletion (focusField prop).
 */

import { AppBar } from '../ui';
import { t } from '../../lib/i18n';

interface EditProfileStubProps {
  focusField?: string;
  onBack: () => void;
}

export function EditProfileStub({ focusField, onBack }: EditProfileStubProps) {
  return (
    <main className="screen">
      <AppBar title={t('Edit Profile')} onBack={onBack} />
      <div className="prof-edit-stub">
        <p className="small">
          {t('Edit Profile is coming in the next prompt.')}
          {focusField && (
            <> {t('Will focus field: {field}', { field: focusField })}</>
          )}
        </p>
      </div>
    </main>
  );
}
