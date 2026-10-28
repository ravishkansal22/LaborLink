'use client';

/**
 * Uber-style flat account Profile. Preserves every ProfileScreen behaviour
 * (edit, language, location picker, jobs, worker mode, sign-out, sheets)
 * with a config-driven row list. Gated from ProfileScreen via USE_UBER_STYLE_PROFILE.
 *
 * ThemeProvider wraps Profile only (Phase A) — applies data-theme on .device-screen.
 */

import { useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  Globe,
  HardHat,
  HelpCircle,
  House,
  MapPin,
  Palette,
  Receipt,
  Shield,
  User,
  UserRound,
} from 'lucide-react';
import { useProfile, maskPhone, computeCompletion, type ProfileData } from '../__mocks__';
import { EditProfileStub } from '../EditProfileStub';
import { LanguageSheet } from '../LanguageSheet';
import { ComingSoonSheet } from '../ComingSoonSheet';
import { useLocation } from '../../../lib/location';
import { languageInfo, type Language } from '../../../lib/languages';
import type { Session } from '../../../lib/session';
import type { EmployerGo } from '../../../screens/employer';
import { BottomNav } from '../../ui';
import { t } from '../../../lib/i18n';
import type { SavedAddress, PlaceSuggestion } from '../../../lib/location/types';
import { ThemeProvider, useTheme } from '../../../lib/theme';
import { AccountTopBar } from './AccountTopBar';
import { AccountHeader } from './AccountHeader';
import { AccountCompletion } from './AccountCompletion';
import { AccountVerifyBanner } from './AccountVerifyBanner';
import { AccountRowList } from './AccountRowList';
import { AccountFooter } from './AccountFooter';
import { ThemeSheet, themePreferenceLabel } from './ThemeSheet';
import type { AccountRowConfig } from './types';
// @ts-ignore
import './profile-theme.css';

interface AccountProfileScreenProps {
  session: Session;
  go: EmployerGo;
  onWorkerMode: () => void;
  onSignOut: () => void;
  onLanguage: (language: Language) => void;
}

type EditState = { open: false } | { open: true; focusField?: string };
type SoonId = 'payments' | 'help' | 'safety' | 'notifications' | null;

function isSavedAddress(item: SavedAddress | PlaceSuggestion): item is SavedAddress {
  return 'label' in item;
}

/** Read-only label/area for the Saved addresses subtitle. */
function selectedAddressSubtitle(
  selected: SavedAddress | PlaceSuggestion | null,
): string {
  if (!selected) return t('No address selected');
  if (isSavedAddress(selected)) {
    const area = [selected.area, selected.city].filter(Boolean).join(', ');
    return area ? `${selected.label} · ${area}` : selected.label;
  }
  return selected.subtitle ? `${selected.title} · ${selected.subtitle}` : selected.title;
}

/** First incomplete field key for Edit Profile focus (same fields as computeCompletion). */
function firstMissingField(profile: ProfileData): string | undefined {
  if (!profile.name.trim()) return 'name';
  if (!profile.phone.trim()) return 'phone';
  if (!profile.address?.trim()) return 'address';
  if (profile.latitude == null || profile.longitude == null) return 'location';
  return undefined;
}

function AccountProfileScreenInner({
  session,
  go,
  onWorkerMode,
  onSignOut,
  onLanguage,
}: AccountProfileScreenProps) {
  const { profile } = useProfile(session);
  const [currentName, setCurrentName] = useState(session.employer?.name || profile?.name || '');
  const { selected, openPicker } = useLocation();
  const { preference } = useTheme();
  const [edit, setEdit] = useState<EditState>({ open: false });
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [soon, setSoon] = useState<SoonId>(null);

  const openEdit = (focusField?: string) => setEdit({ open: true, focusField });
  const closeEdit = () => setEdit({ open: false });

  if (edit.open) {
    return (
      <EditProfileStub
        session={session}
        focusField={edit.focusField}
        onBack={closeEdit}
        onUpdated={(updatedName, updatedEmail) => {
          setCurrentName(updatedName);
          if (session.employer) {
            session.employer.name = updatedName;
            if (updatedEmail) {
              (session.employer as any).email = updatedEmail;
            }
          }
        }}
      />
    );
  }

  if (!profile) {
    return (
      <main className="screen has-nav acct">
        <p className="small muted">{t('No profile data.')}</p>
      </main>
    );
  }

  const activeProfile: ProfileData = { ...profile, name: currentName || profile.name };
  const pct = computeCompletion(activeProfile);
  const maskedPh = maskPhone(activeProfile.phone);
  const currentLangName = languageInfo(session.language).native;
  const addressSub = selectedAddressSubtitle(selected);
  const themeLabel = themePreferenceLabel(preference);

  const soonTitles: Record<Exclude<SoonId, null>, string> = {
    payments: t('Payments & invoices'),
    help: t('Help & support'),
    safety: t('Safety centre'),
    notifications: t('Notifications'),
  };

  const rows: AccountRowConfig[] = [
    {
      id: 'acct-row-personal',
      title: t('Personal details'),
      subtitle: t('Name, email, photo and more'),
      icon: User,
      onPress: () => openEdit(),
      showChevron: true,
    },
    {
      id: 'acct-row-addresses',
      title: t('Saved addresses'),
      subtitle: addressSub,
      icon: MapPin,
      onPress: () => openPicker(),
      showChevron: true,
    },
    {
      id: 'acct-row-jobs',
      title: t('Jobs posted'),
      subtitle: t('View and manage your posted jobs'),
      value: String(session.jobIds.length),
      icon: ClipboardList,
      onPress: go.jobs,
      showChevron: true,
    },
    {
      id: 'acct-row-payments',
      title: t('Payments & invoices'),
      icon: Receipt,
      onPress: () => setSoon('payments'),
    },
    {
      id: 'acct-row-help',
      title: t('Help & support'),
      icon: HelpCircle,
      onPress: () => setSoon('help'),
    },
    {
      id: 'acct-row-safety',
      title: t('Safety centre'),
      icon: Shield,
      onPress: () => setSoon('safety'),
    },
    {
      id: 'acct-row-notifications',
      title: t('Notifications'),
      icon: Bell,
      onPress: () => setSoon('notifications'),
    },
    {
      id: 'acct-row-language',
      title: t('Language'),
      value: currentLangName,
      icon: Globe,
      onPress: () => setLangOpen(true),
      showChevron: true,
    },
    {
      id: 'acct-row-appearance',
      title: t('Appearance'),
      subtitle: themeLabel,
      icon: Palette,
      onPress: () => setThemeOpen(true),
      showChevron: true,
    },
    {
      id: 'acct-row-worker',
      title: t('Looking for work too?'),
      subtitle: t('Switch to worker mode to find nearby job opportunities.'),
      icon: HardHat,
      onPress: onWorkerMode,
      showChevron: true,
    },
  ];

  return (
    <main className="screen has-nav acct">
      <div className="acct-content">
        <AccountTopBar />

        <AccountHeader
          name={activeProfile.name}
          role={profile.role}
          maskedPhone={maskedPh}
          photoUrl={profile.photoUrl}
          onOpenEdit={() => openEdit('name')}
        />

        <AccountCompletion
          pct={pct}
          onOpenEdit={() => openEdit(firstMissingField(activeProfile))}
        />

        <AccountVerifyBanner verified={profile.verified} />

        <AccountRowList rows={rows} />

        <AccountFooter
          onSignOut={onSignOut}
          employerId={session.userId || profile.employerId}
        />
      </div>

      <LanguageSheet
        open={langOpen}
        language={session.language}
        onLanguage={onLanguage}
        onClose={() => setLangOpen(false)}
      />

      <ComingSoonSheet
        open={soon !== null}
        title={soon ? soonTitles[soon] : ''}
        onClose={() => setSoon(null)}
      />

      <ThemeSheet open={themeOpen} onClose={() => setThemeOpen(false)} />

      <BottomNav
        items={[
          { label: 'Home', icon: <House size={22} />, active: false, onClick: go.home },
          { label: 'My jobs', icon: <BriefcaseBusiness size={22} />, active: false, onClick: go.jobs },
          { label: 'Profile', icon: <UserRound size={22} />, active: true, onClick: go.profile },
        ]}
      />
    </main>
  );
}

export function AccountProfileScreen(props: AccountProfileScreenProps) {
  return <AccountProfileScreenInner {...props} />;
}