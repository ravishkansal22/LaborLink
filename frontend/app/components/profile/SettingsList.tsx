'use client';

/**
 * SettingsList
 *
 * White rounded-2xl card of settings rows:
 *   Personal details → Edit Profile
 *   Saved addresses  → NOTE: LocationPicker has no imperative open API, shows saved-address
 *                      count as placeholder (KNOWN LIMITATION - see comment below)
 *   Payments & invoices → ComingSoonSheet
 *   Help & support       → ComingSoonSheet
 *   Safety centre        → ComingSoonSheet
 *   Language             → LanguageSheet (value = current language native name)
 *   Notifications        → ComingSoonSheet
 *
 * ⚠️  LOCATION LIMITATION: LocationPicker (app/components/location) requires being
 *     rendered as a React subtree with `open` prop — there's no standalone context
 *     method like `openLocationPicker()`. Opening it from inside SettingsList would
 *     require lifting state to the Profile screen or adding a new context method.
 *     For now, the "Saved addresses" row shows the address string as a value and
 *     clicking shows a ComingSoonSheet with "Manage addresses from the Home screen."
 *     TELL: Please let me know if you'd like me to lift the picker open state to
 *     EmployerProfileScreen so "Saved addresses" can properly open it.
 */

import { useState } from 'react';
import {
  Bell, Globe, HardHat, HelpCircle, MapPin, Receipt, Shield, User,
} from 'lucide-react';
import { SettingsRow } from './SettingsRow';
import { LanguageSheet } from './LanguageSheet';
import { ComingSoonSheet } from './ComingSoonSheet';
import { languageInfo, type Language } from '../../lib/languages';
import { t } from '../../lib/i18n';

type SheetId = 'payments' | 'help' | 'safety' | 'notifications' | 'addresses' | null;

interface SettingsListProps {
  language: Language;
  onLanguage: (lang: Language) => void;
  onOpenEdit: () => void;
  savedAddressValue?: string;
}

export function SettingsList({
  language,
  onLanguage,
  onOpenEdit,
  savedAddressValue,
}: SettingsListProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetId>(null);

  const currentLangName = languageInfo(language).native;

  const comingSoonTitle: Record<Exclude<SheetId, null>, string> = {
    payments: t('Payments & invoices'),
    help: t('Help & support'),
    safety: t('Safety centre'),
    notifications: t('Notifications'),
    addresses: t('Saved addresses'),
  };

  return (
    <>
      <div className="prof-settings-list">
        <SettingsRow
          id="prof-row-personal"
          Icon={User}
          label={t('Personal details')}
          onClick={onOpenEdit}
        />
        <SettingsRow
          id="prof-row-addresses"
          Icon={MapPin}
          label={t('Saved addresses')}
          value={savedAddressValue}
          onClick={() => setSheet('addresses')}
        />
        <SettingsRow
          id="prof-row-payments"
          Icon={Receipt}
          label={t('Payments & invoices')}
          onClick={() => setSheet('payments')}
        />
        <SettingsRow
          id="prof-row-help"
          Icon={HelpCircle}
          label={t('Help & support')}
          onClick={() => setSheet('help')}
        />
        <SettingsRow
          id="prof-row-safety"
          Icon={Shield}
          label={t('Safety centre')}
          onClick={() => setSheet('safety')}
        />
        <SettingsRow
          id="prof-row-language"
          Icon={Globe}
          label={t('Language')}
          value={currentLangName}
          onClick={() => setLangOpen(true)}
        />
        <SettingsRow
          id="prof-row-notifications"
          Icon={Bell}
          label={t('Notifications')}
          onClick={() => setSheet('notifications')}
        />
      </div>

      {/* Language sheet – uses existing LANGUAGES array + existing handler */}
      <LanguageSheet
        open={langOpen}
        language={language}
        onLanguage={onLanguage}
        onClose={() => setLangOpen(false)}
      />

      {/* Shared coming-soon sheet for unimplemented rows */}
      <ComingSoonSheet
        open={sheet !== null && sheet !== 'addresses'}
        title={sheet && sheet !== 'addresses' ? comingSoonTitle[sheet] : ''}
        onClose={() => setSheet(null)}
      />

      {/* Saved addresses: honest placeholder until LocationPicker state is lifted */}
      <ComingSoonSheet
        open={sheet === 'addresses'}
        title={comingSoonTitle.addresses}
        onClose={() => setSheet(null)}
      />

      {/* KNOWN LIMITATION NOTE: to properly open the location picker, lift
          `pickerOpen` state to EmployerProfileScreen and pass an `onOpenAddresses`
          prop here. File: app/screens/employer.tsx EmployerHomeScreen has the
          pattern: LocationPicker open={pickerOpen} onClose={…} */}
      <HardHat style={{ display: 'none' }} size={0} aria-hidden="true" />
    </>
  );
}
