'use client';

/**
 * Appearance sheet: Light / Dark / System. Applies instantly via useTheme().
 */

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { ProfileBottomSheet } from '../BottomSheet';
import { useTheme, type ThemePreference } from '../../../lib/theme';
import { t } from '../../../lib/i18n';
import type { LucideIcon } from 'lucide-react';

interface ThemeSheetProps {
  open: boolean;
  onClose: () => void;
}

interface ThemeOption {
  id: ThemePreference;
  title: string;
  description: string;
  Icon: LucideIcon;
}

export function ThemeSheet({ open, onClose }: ThemeSheetProps) {
  const { preference, setPreference } = useTheme();

  const options: ThemeOption[] = [
    {
      id: 'light',
      title: t('Light'),
      description: t('Always use light appearance'),
      Icon: Sun,
    },
    {
      id: 'dark',
      title: t('Dark'),
      description: t('Always use dark appearance'),
      Icon: Moon,
    },
    {
      id: 'system',
      title: t('System'),
      description: t('Matches your device'),
      Icon: Monitor,
    },
  ];

  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={t('Appearance')}>
      <div className="pf-theme-list" role="radiogroup" aria-label={t('Appearance')}>
        {options.map(({ id, title, description, Icon }) => {
          const active = preference === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              className="pf-theme-option"
              onClick={() => setPreference(id)}
            >
              <span className="pf-theme-option-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <span className="pf-theme-option-body">
                <span className="pf-theme-option-title">{title}</span>
                <span className="pf-theme-option-desc">{description}</span>
              </span>
              {active ? (
                <Check size={20} strokeWidth={2.5} className="pf-theme-option-check" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn-primary pf-theme-done" onClick={onClose}>
        {t('Done')}
      </button>
    </ProfileBottomSheet>
  );
}

/** Label for the Appearance row subtitle. */
export function themePreferenceLabel(preference: ThemePreference): string {
  if (preference === 'dark') return t('Dark');
  if (preference === 'system') return t('System');
  return t('Light');
}
