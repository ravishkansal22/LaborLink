'use client';

/**
 * LanguageSheet
 *
 * Bottom sheet listing all the same languages as the old LanguageSetting <select>.
 * Radio-style rows; active language highlighted.
 * Calls the EXISTING onLanguage handler exactly as the old select did.
 * Keeps the Sarvam AI note.
 */

import { Check } from 'lucide-react';
import { LANGUAGES, type Language } from '../../lib/languages';
import { ProfileBottomSheet } from './BottomSheet';
import { t } from '../../lib/i18n';

interface LanguageSheetProps {
  open: boolean;
  language: Language;
  onLanguage: (lang: Language) => void;
  onClose: () => void;
}

export function LanguageSheet({ open, language, onLanguage, onClose }: LanguageSheetProps) {
  const handleSelect = (id: Language) => {
    onLanguage(id);
    onClose();
  };

  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={t('Language')}>
      <p className="small prof-lang-note">
        {t('Screens and voice input switch to this language. Translations are made with Sarvam AI.')}
      </p>
      <div className="prof-lang-list">
        {LANGUAGES.map((lang) => {
          const active = lang.id === language;
          return (
            <button
              key={lang.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`prof-lang-row ${active ? 'prof-lang-row-active' : ''}`}
              onClick={() => handleSelect(lang.id as Language)}
            >
              <span className="prof-lang-name">
                <span className="prof-lang-native">{lang.native}</span>
                {lang.id !== 'en' && (
                  <span className="prof-lang-english">{lang.english}</span>
                )}
              </span>
              {active && (
                <Check size={18} strokeWidth={2.5} className="prof-lang-check" />
              )}
            </button>
          );
        })}
      </div>
    </ProfileBottomSheet>
  );
}
