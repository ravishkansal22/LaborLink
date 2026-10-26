'use client';

/**
 * Frozen pre–Uber-style Worker Profile. Restored when
 * USE_NEW_WORKER_PROFILE = false in screens/worker.tsx.
 */

import { useState } from 'react';
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Check,
  House,
  Info,
  LogOut,
  MapPin,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import {
  AppBar,
  Avatar,
  BottomNav,
  ErrorNote,
  LanguageSetting,
  Loading,
  SettingRow,
} from '../../ui';
import {
  allTrades,
  api,
  tradeNames,
  when,
  type Trade,
} from '../../../lib/api';
import { useLoad, type Language } from '../../../lib/session';
import { t } from '../../../lib/i18n';
import { AvailabilitySwitch } from '../../AvailabilitySwitch';
import type { WorkerProfileGo } from './WorkerProfileScreen';

function workerNav(active: 'home' | 'jobs' | 'passbook' | 'profile', go: WorkerProfileGo) {
  return (
    <BottomNav
      items={[
        { label: 'Home', icon: <House size={22} />, active: active === 'home', onClick: go.home },
        { label: 'Find work', icon: <BriefcaseBusiness size={22} />, active: active === 'jobs', onClick: go.jobs },
        { label: 'Passbook', icon: <BookOpen size={22} />, active: active === 'passbook', onClick: go.passbook },
        { label: 'Profile', icon: <UserRound size={22} />, active: active === 'profile', onClick: go.profile },
      ]}
    />
  );
}

function OnlineSwitch({
  workerId,
  available,
  onChanged,
}: {
  workerId: string;
  available: boolean;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => {
    setSaving(true);
    try {
      await api.updateWorker(workerId, {
        availability: available ? 'unavailable' : 'available',
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <span className={`online avail-label ${available ? 'on' : ''}`}>
        {available ? t('Online') : t('Offline')}
      </span>
      <AvailabilitySwitch
        on={available}
        disabled={saving}
        onChange={() => void toggle()}
        label={t('Available for work')}
      />
    </>
  );
}

export function WorkerProfileScreenLegacy({
  workerId,
  go,
  onHireMode,
  onSignOut,
  hasEmployer,
  language,
  onLanguage,
}: {
  workerId: string;
  go: WorkerProfileGo;
  onHireMode: () => void;
  onSignOut: () => void;
  hasEmployer: boolean;
  language: Language;
  onLanguage: (language: Language) => void;
}) {
  const data = useLoad(async () => {
    const [worker, passbook] = await Promise.all([
      api.getWorker(workerId),
      api.passbook(workerId),
    ]);
    return { worker, passbook };
  }, [workerId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
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

  return (
    <main className="screen has-nav">
      <AppBar title={t('Profile')} right={<span className="appbar-spacer" />} />
      {!data.data ? (
        data.error ? (
          <ErrorNote error={data.error} onRetry={() => void data.reload()} />
        ) : (
          <Loading />
        )
      ) : (() => {
        const w = data.data.worker;
        const toggleTrade = (trade: Trade) => {
          const next = w.trades.includes(trade)
            ? w.trades.filter((x) => x !== trade)
            : [...w.trades, trade];
          if (next.length) void patch({ trades: next });
        };
        return (
          <>
            <section className="profile-head">
              <Avatar name={w.display_name} size={64} />
              <div>
                <h2 className="h2">{w.display_name}</h2>
                <p className="small">
                  {w.trades.map((tr) => t(tradeNames[tr].en)).join(', ')}
                  {w.years_experience != null
                    ? ` · ${t('{n} years', { n: w.years_experience })}`
                    : ''}
                </p>
                <span className="row gap-4 small mt-2">
                  <BadgeCheck size={14} className="muted" />
                  {t('Not verified — details are self-declared')}
                </span>
              </div>
            </section>
            <div className="stat-tiles mt-16">
              <div>
                <strong>{data.data.passbook.summary.completed_jobs}</strong>
                <small>{t('Jobs completed')}</small>
              </div>
              <div>
                <strong>
                  {w.service_radius_km} {t('km')}
                </strong>
                <small>{t('Work radius')}</small>
              </div>
              <div>
                <strong>{when(w.created_at).split(',')[0]}</strong>
                <small>{t('Joined')}</small>
              </div>
            </div>
            <section className="card mt-12">
              <div className="row">
                <div className="grow">
                  <strong className="h4">{t('Available for work')}</strong>
                  <p className="small">{t('Customers nearby can see you and send jobs')}</p>
                </div>
                <OnlineSwitch
                  workerId={workerId}
                  available={w.availability === 'available'}
                  onChanged={() => void data.reload(true)}
                />
              </div>
            </section>
            <section className="card mt-12">
              <h3 className="h4">{t('Trades')}</h3>
              <div className="tag-row mt-10">
                {allTrades.map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    disabled={saving}
                    className={`tag ${w.trades.includes(tr) ? 'on' : ''}`}
                    onClick={() => toggleTrade(tr)}
                  >
                    {w.trades.includes(tr) && <Check size={14} />}
                    {t(tradeNames[tr].en)}
                  </button>
                ))}
              </div>
              <p className="field-label mt-12">{t('Work within')}</p>
              <div className="row gap-6">
                {[2, 5, 10, 15, 25].map((km) => (
                  <button
                    key={km}
                    type="button"
                    disabled={saving}
                    className={`seg-btn ${w.service_radius_km === km ? 'on' : ''}`}
                    onClick={() => void patch({ service_radius_km: km })}
                  >
                    {km} {t('km')}
                  </button>
                ))}
              </div>
            </section>
            {Boolean(error) && (
              <div className="mt-12">
                <ErrorNote error={error} />
              </div>
            )}
            <LanguageSetting language={language} onChange={onLanguage} />
            <p className="list-title">{t('Account')}</p>
            <div className="list">
              <SettingRow
                icon={<MapPin size={18} />}
                title={t('Base location')}
                detail={
                  w.location.locality
                  ?? `${w.location.latitude.toFixed(4)}, ${w.location.longitude.toFixed(4)}`
                }
              />
              <SettingRow
                icon={<RefreshCw size={18} />}
                title={t('Switch to hiring mode')}
                detail={
                  hasEmployer
                    ? t('Open your employer dashboard')
                    : t('Set up an employer profile')
                }
                onClick={onHireMode}
              />
            </div>
            <button
              className="btn btn-ghost danger mt-16"
              type="button"
              onClick={onSignOut}
            >
              <LogOut size={17} />
              {t('Sign out of this phone')}
            </button>
            <p className="small center with-icon centered">
              <Info size={12} />
              {t('Worker ID')} {w.id.slice(0, 8)}
            </p>
          </>
        );
      })()}
      {workerNav('profile', go)}
    </main>
  );
}
