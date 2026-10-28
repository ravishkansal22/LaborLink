'use client';

/**
 * Uber-style flat Worker Profile. Reuses account primitives + theme stack.
 * Gated from screens/worker.tsx via USE_NEW_WORKER_PROFILE.
 */

import { useState } from 'react';
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Globe,
  HelpCircle,
  House,
  Palette,
  Receipt,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  UserRound,
} from 'lucide-react';
import { AccountTopBar } from '../account/AccountTopBar';
import { AccountCompletion } from '../account/AccountCompletion';
import { AccountVerifyBanner } from '../account/AccountVerifyBanner';
import { AccountRowList } from '../account/AccountRowList';
import { ThemeSheet, themePreferenceLabel } from '../account/ThemeSheet';
import type { AccountRowConfig } from '../account/types';
import { LanguageSheet } from '../LanguageSheet';
import { ComingSoonSheet } from '../ComingSoonSheet';
import { ThemeProvider, useTheme } from '../../../lib/theme';
import { computeWorkerCompletion, maskPhone } from '../../../lib/profile';
import { api, tradeNames, when, type Trade } from '../../../lib/api';
import { useLoad, type Language } from '../../../lib/session';
import { BottomNav, ErrorNote, Loading } from '../../ui';
import { t } from '../../../lib/i18n';
import { languageInfo } from '../../../lib/languages';
import { WorkerHero } from './WorkerHero';
import { WorkerStatsStrip } from './WorkerStatsStrip';
import { WorkerAvailabilityRow } from './WorkerAvailabilityRow';
import { WorkerTradesSection } from './WorkerTradesSection';
import { WorkerRadiusSection } from './WorkerRadiusSection';
import { WorkerBaseLocationRow } from './WorkerBaseLocationRow';
import { WorkerFooter } from './WorkerFooter';
import { WorkerEditProfileScreen } from './WorkerEditProfileScreen';
import { ConfirmActionSheet } from './ConfirmActionSheet';
import { useWorkerExtras } from './useWorkerExtras';
// @ts-ignore
import '../account/profile-theme.css';
// @ts-ignore
import './worker-profile.css';

export type WorkerProfileGo = {
  home: () => void;
  jobs: () => void;
  passbook: () => void;
  profile: () => void;
};

export interface WorkerProfileScreenProps {
  workerId: string;
  go: WorkerProfileGo;
  onHireMode: () => void;
  onSignOut: () => void;
  hasEmployer: boolean;
  language: Language;
  onLanguage: (language: Language) => void;
}

type EditState = { open: false } | { open: true; focusField?: string };
type SoonId = 'payments' | 'help' | 'safety' | 'notifications' | null;

function firstEditableMissing(missing: string[]): string | undefined {
  for (const label of missing) {
    if (label === 'Full name') return 'name';
    if (label === 'Phone') return 'phone';
    if (label === 'Photo') return 'photo';
    if (label === 'Email') return 'email';
    if (label === 'Date of birth or gender') return 'dob';
    if (label === 'Years of experience') return 'yearsExperience';
  }
  return undefined;
}

function WorkerBottomNav({ go }: { go: WorkerProfileGo }) {
  return (
    <BottomNav
      items={[
        { label: 'Home', icon: <House size={22} />, active: false, onClick: go.home },
        { label: 'Find work', icon: <BriefcaseBusiness size={22} />, active: false, onClick: go.jobs },
        { label: 'Passbook', icon: <BookOpen size={22} />, active: false, onClick: go.passbook },
        { label: 'Profile', icon: <UserRound size={22} />, active: true, onClick: go.profile },
      ]}
    />
  );
}

function WorkerProfileScreenInner({
  workerId,
  go,
  onHireMode,
  onSignOut,
  hasEmployer,
  language,
  onLanguage,
}: WorkerProfileScreenProps) {
  const { preference } = useTheme();
  const { extras, ready, persist, resetExtras } = useWorkerExtras(workerId);
  const data = useLoad(async () => {
    const [worker, passbook] = await Promise.all([
      api.getWorker(workerId),
      api.passbook(workerId),
    ]);
    return { worker, passbook };
  }, [workerId]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [edit, setEdit] = useState<EditState>({ open: false });
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [soon, setSoon] = useState<SoonId>(null);
  const [hireConfirm, setHireConfirm] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  const patch = async (body: Parameters<typeof api.updateWorker>[1]) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateWorker(workerId, body);
      await data.reload(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const closeSheets = () => {
    setLangOpen(false);
    setThemeOpen(false);
    setSoon(null);
    setHireConfirm(false);
    setSignOutConfirm(false);
  };

  const openEdit = (focusField?: string) => {
    closeSheets();
    setEdit({ open: true, focusField });
  };
  const closeEdit = () => setEdit({ open: false });

  if (edit.open && data.data && ready) {
    const w = data.data.worker;
    return (
      <WorkerEditProfileScreen
        workerId={workerId}
        displayName={w.display_name}
        phoneDigits={extras?.phone?.replace(/\D/g, '').slice(0, 10) ?? ''}
        extras={extras}
        backendYears={w.years_experience}
        focusField={edit.focusField}
        onBack={closeEdit}
        onPersist={persist}
        onResetExtras={resetExtras}
      />
    );
  }

  if (!data.data || !ready) {
    return (
      <main className="screen has-nav acct">
        {data.error ? (
          <ErrorNote error={data.error} onRetry={() => void data.reload()} />
        ) : (
          <Loading />
        )}
        <WorkerBottomNav go={go} />
      </main>
    );
  }

  const w = data.data.worker;
  const displayName = (extras?.fullName?.trim() || w.display_name).trim() || '—';
  const phoneDigits = extras?.phone?.replace(/\D/g, '').slice(0, 10) ?? '';
  const maskedPh = phoneDigits ? maskPhone(`+91 ${phoneDigits}`) : '—';
  const primaryTrade = w.trades[0];
  const tradeLine = primaryTrade
    ? `${t(tradeNames[primaryTrade].en)}${
        w.years_experience != null
          ? ` · ${t('{n} years', { n: w.years_experience })}`
          : ''
      }`
    : w.years_experience != null
      ? t('{n} years', { n: w.years_experience })
      : '';

  const baseLocation =
    w.location.locality
    ?? `${w.location.latitude.toFixed(4)}, ${w.location.longitude.toFixed(4)}`;

  const completion = computeWorkerCompletion({
    hasName: Boolean(displayName && displayName !== '—'),
    hasPhone: phoneDigits.length === 10,
    hasPhoto: Boolean(extras?.photoDataUrl?.trim()),
    hasEmail: Boolean(extras?.email?.trim()),
    hasDobOrGender: Boolean(extras?.dob?.trim() || extras?.gender),
    hasTrade: w.trades.length > 0,
    hasYearsExperience: w.years_experience != null,
    hasBaseLocation: Boolean(
      w.location.locality
      || (Number.isFinite(w.location.latitude) && Number.isFinite(w.location.longitude)),
    ),
  });

  const toggleTrade = (trade: Trade) => {
    const next = w.trades.includes(trade)
      ? w.trades.filter((x) => x !== trade)
      : [...w.trades, trade];
    if (next.length) void patch({ trades: next });
  };

  const currentLangName = languageInfo(language).native;
  const themeLabel = themePreferenceLabel(preference);
  const soonTitles: Record<Exclude<SoonId, null>, string> = {
    payments: t('Payments'),
    help: t('Help & support'),
    safety: t('Safety centre'),
    notifications: t('Notifications'),
  };

  const rowsBeforeLoc: AccountRowConfig[] = [
    {
      id: 'wp-row-personal',
      title: t('Personal details'),
      subtitle: t('Name, email, photo and more'),
      icon: User,
      onPress: () => openEdit(),
      showChevron: true,
    },
  ];

  const rowsAfterLoc: AccountRowConfig[] = [
    {
      id: 'wp-row-passbook',
      title: t('Passbook'),
      subtitle: t('View your completed jobs'),
      icon: BookOpen,
      onPress: go.passbook,
      showChevron: true,
    },
    {
      id: 'wp-row-payments',
      title: t('Payments'),
      icon: Receipt,
      onPress: () => {
        closeSheets();
        setSoon('payments');
      },
    },
    {
      id: 'wp-row-help',
      title: t('Help & support'),
      icon: HelpCircle,
      onPress: () => {
        closeSheets();
        setSoon('help');
      },
    },
    {
      id: 'wp-row-safety',
      title: t('Safety centre'),
      icon: Shield,
      onPress: () => {
        closeSheets();
        setSoon('safety');
      },
    },
    {
      id: 'wp-row-notifications',
      title: t('Notifications'),
      icon: Bell,
      onPress: () => {
        closeSheets();
        setSoon('notifications');
      },
    },
    {
      id: 'wp-row-language',
      title: t('Language'),
      value: currentLangName,
      icon: Globe,
      onPress: () => {
        closeSheets();
        setLangOpen(true);
      },
      showChevron: true,
    },
    {
      id: 'wp-row-appearance',
      title: t('Appearance'),
      subtitle: themeLabel,
      icon: Palette,
      onPress: () => {
        closeSheets();
        setThemeOpen(true);
      },
      showChevron: true,
    },
    {
      id: 'wp-row-hire',
      title: t('Switch to hiring mode'),
      subtitle: hasEmployer
        ? t('Open your employer dashboard')
        : t('Set up an employer profile'),
      icon: RefreshCw,
      onPress: () => {
        closeSheets();
        setHireConfirm(true);
      },
      showChevron: true,
    },
  ];

  return (
    <main className="screen has-nav acct">
      <div className="acct-content">
        <AccountTopBar />

        <WorkerHero
          name={displayName}
          tradeLine={tradeLine}
          maskedPhone={maskedPh}
          photoUrl={extras?.photoDataUrl}
          onOpenEdit={() => openEdit()}
        />

        <p className="wp-status" role="status">
          <ShieldCheck size={14} className="wp-status-icon" aria-hidden="true" />
          {t('Not verified — details are self-declared')}
        </p>

        <AccountCompletion
          pct={completion.percent}
          onOpenEdit={() => openEdit(firstEditableMissing(completion.missingFields))}
        />

        <AccountVerifyBanner verified={false} />

        <WorkerStatsStrip
          jobsCompleted={data.data.passbook.summary.completed_jobs}
          radiusKm={w.service_radius_km}
          joinedLabel={when(w.created_at).split(',')[0] ?? '—'}
        />

        <WorkerAvailabilityRow
          workerId={workerId}
          available={w.availability === 'available'}
          onChanged={() => {
            setError(null);
            void data.reload(true);
          }}
          onError={setError}
        />

        <WorkerTradesSection
          selected={w.trades}
          disabled={saving}
          onToggle={toggleTrade}
        />

        <WorkerRadiusSection
          valueKm={w.service_radius_km}
          disabled={saving}
          onSelect={(km) => void patch({ service_radius_km: km })}
        />

        {Boolean(error) && (
          <div>
            <ErrorNote error={error} />
          </div>
        )}

        <AccountRowList rows={rowsBeforeLoc} />
        <WorkerBaseLocationRow subtitle={baseLocation} />
        <AccountRowList rows={rowsAfterLoc} />

        <WorkerFooter
          workerIdShort={w.id.slice(0, 8)}
          onSignOutPress={() => {
            closeSheets();
            setSignOutConfirm(true);
          }}
        />
      </div>

      <LanguageSheet
        open={langOpen}
        language={language}
        onLanguage={onLanguage}
        onClose={() => setLangOpen(false)}
      />

      <ComingSoonSheet
        open={soon !== null}
        title={soon ? soonTitles[soon] : ''}
        onClose={() => setSoon(null)}
      />

      <ThemeSheet open={themeOpen} onClose={() => setThemeOpen(false)} />

      <ConfirmActionSheet
        open={hireConfirm}
        title={t('Switch to hiring mode')}
        body={
          hasEmployer
            ? t('Open your employer dashboard on this phone?')
            : t('Set up an employer profile on this phone?')
        }
        confirmLabel={t('Continue')}
        onClose={() => setHireConfirm(false)}
        onConfirm={onHireMode}
      />

      <ConfirmActionSheet
        open={signOutConfirm}
        title={t('Sign out of this phone')}
        body={t('You will need to set up again to use LaborLink on this phone.')}
        confirmLabel={t('Sign out')}
        danger
        onClose={() => setSignOutConfirm(false)}
        onConfirm={onSignOut}
      />

      <WorkerBottomNav go={go} />
    </main>
  );
}

export function WorkerProfileScreenNew(props: WorkerProfileScreenProps) {
  return <WorkerProfileScreenInner {...props} />;
}
