'use client';

/**
 * New Employer Home layout. Gated by USE_NEW_EMPLOYER_HOME in screens/employer.tsx.
 * Preserves every handler/route from the legacy EmployerHomeScreen — look/layout only.
 *
 * The 3D WorkerGrid is not mounted here (local constant false). WorkerGrid files
 * and the USE_3D_WORKER_GRID flag in employer.tsx stay untouched for the legacy path.
 */

import { useState } from 'react';
import { BriefcaseBusiness, ClipboardList, House, UserRound } from 'lucide-react';
import { t, tx } from '../../../lib/i18n';
import {
  Avatar,
  BottomNav,
  Empty,
  ErrorNote,
  JobSteps,
  Loading,
  StatusChip,
  stepLabels,
  stepsFor,
} from '../../ui';
import { TrackBanner } from '../../../screens/tracking';
import {
  api,
  money,
  tradeNames,
  when,
  type Job,
  type Trade,
} from '../../../lib/api';
import { useLoad, type Session } from '../../../lib/session';
import { LocationHeader } from '../../location';
import { useLocation } from '../../../lib/location';
import { ComingSoonSheet } from '../../profile/ComingSoonSheet';
import type { EmployerGo } from '../../../screens/employer';
import { ActionSearchButton } from './ActionSearchButton';
import { PopularCategories } from './PopularCategories';
import { HeroBanner } from './HeroBanner';
import { NearbyWorkers } from './NearbyWorkers';
import { SectionHeader } from './SectionHeader';
import styles from './HomeScreen.new.module.css';

const finished = (job: Job) => job.status === 'completed' || job.status === 'disputed';

/** Same loader as legacy EmployerHomeScreen — existing job fetches only. */
function useMyJobs(session: Session, pollMs?: number) {
  return useLoad(async () => {
    const jobs = await Promise.all(session.jobIds.map((id) => api.getJob(id).catch((err: { status?: number }) => {
      if (err.status === 404) return null;
      throw err;
    })));
    return (jobs.filter(Boolean) as Job[]).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [session.jobIds.join(',')], pollMs);
}

function JobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const steps = stepsFor(job.status);
  const estimate = job.price_estimate;
  return (
    <button type="button" className={styles.jobCard} onClick={onOpen}>
      <div className={styles.jobTop}>
        <StatusChip status={job.status} />
        <span className={styles.jobWhen}>{when(job.updated_at)}</span>
      </div>
      <h3 className={styles.jobTitle}>{tx(job.work_order.problem_summary)}</h3>
      <p className={styles.jobMeta}>
        {job.trade ? t(tradeNames[job.trade].en) : t('Trade not decided')}
        {' · '}
        {estimate ? `${money(estimate.min_amount)}–${money(estimate.max_amount)}` : t('No price yet')}
      </p>
      {!['estimated', 'needs_information'].includes(job.status) && (
        <JobSteps labels={stepLabels} {...steps} />
      )}
    </button>
  );
}

function employerNav(active: 'home' | 'jobs' | 'profile', go: EmployerGo) {
  return (
    <BottomNav
      items={[
        { label: 'Home', icon: <House size={22} />, active: active === 'home', onClick: go.home },
        { label: 'My jobs', icon: <BriefcaseBusiness size={22} />, active: active === 'jobs', onClick: go.jobs },
        { label: 'Profile', icon: <UserRound size={22} />, active: active === 'profile', onClick: go.profile },
      ]}
    />
  );
}

export interface EmployerHomeScreenNewProps {
  session: Session;
  go: EmployerGo;
  onNewJob: (trade?: Trade) => void;
  onOpenJob: (id: string) => void;
  onTrack: (id: string) => void;
}

export function EmployerHomeScreenNew({
  session,
  go,
  onNewJob,
  onOpenJob,
  onTrack,
}: EmployerHomeScreenNewProps) {
  const { openPicker } = useLocation();
  const jobs = useMyJobs(session, 10000);
  const active = (jobs.data ?? []).filter((j) => !finished(j));
  const onTheWay = active.filter((j) => j.status === 'booked' || j.status === 'in_progress');
  const employer = session.employer!;
  const firstName = employer.name.split(' ')[0];

  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const openComingSoon = () => setComingSoonOpen(true);

  return (
    <main className={`screen has-nav ${styles.root}`}>
      <header className={`home-head ${styles.head}`}>
        <LocationHeader onClick={() => openPicker()} />
        <button
          type="button"
          onClick={go.profile}
          aria-label={t('Profile')}
          className={`plain ${styles.avatarBtn}`}
        >
          <Avatar name={employer.name} size={36} />
        </button>
      </header>

      {onTheWay.map((j) => (
        <div key={j.id} className="mt-12">
          <TrackBanner
            jobId={j.id}
            employerId={employer.employerId}
            onOpen={() => onTrack(j.id)}
          />
        </div>
      ))}

      <h1 className={styles.greeting}>
        {t('Namaste, {name}', { name: firstName })}
      </h1>
      <p className={styles.subtitle}>
        {t('What work do you need done today?')}
      </p>

      <div className={styles.pillBlock}>
        <ActionSearchButton onDescribeJob={() => onNewJob()} />
        <p className={styles.pillCaption}>
          {t('Add a photo and say or type what’s wrong. You’ll get a clear job description and a fair price range.')}
        </p>
      </div>

      <PopularCategories
        onSelectTrade={(trade) => onNewJob(trade)}
        onMore={openComingSoon}
        onViewAll={openComingSoon}
      />

      <HeroBanner />

      <NearbyWorkers
        onDescribeJob={() => onNewJob()}
        onViewAll={openComingSoon}
      />

      <section aria-label={t('Your active jobs')}>
        <SectionHeader
          title={t('Your active jobs')}
          actionLabel={active.length > 0 ? t('All jobs') : undefined}
          onAction={active.length > 0 ? go.jobs : undefined}
          actionAriaLabel={t('All jobs')}
        />

        {jobs.loading && !jobs.data ? (
          <Loading />
        ) : jobs.error ? (
          <ErrorNote error={jobs.error} onRetry={() => void jobs.reload()} />
        ) : active.length === 0 ? (
          <Empty
            icon={<ClipboardList size={20} />}
            title={t('No active jobs')}
            text={t('Describe a problem to get a price range and offers from workers nearby.')}
          />
        ) : (
          <div className={styles.jobStack}>
            {active.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => onOpenJob(job.id)} />
            ))}
          </div>
        )}
      </section>

      {employerNav('home', go)}

      <ComingSoonSheet
        open={comingSoonOpen}
        title={t('More trades')}
        onClose={() => setComingSoonOpen(false)}
      />
    </main>
  );
}
