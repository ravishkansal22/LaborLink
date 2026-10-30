'use client';

/**
 * New Worker Home. Gated by USE_NEW_WORKER_HOME in screens/worker.tsx.
 * Same data sources / handlers / routes as the legacy WorkerHomeScreen.
 */

import { useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  House,
  Send,
  UserRound,
  Wrench,
} from 'lucide-react';
import { t, tx } from '../../lib/i18n';
import {
  Avatar,
  BottomNav,
  Chip,
  Empty,
  ErrorNote,
  JobSteps,
  Loading,
  StatusChip,
  stepLabels,
  stepsFor,
  type Tone,
} from '../ui';
import {
  api,
  money,
  when,
  type Opportunity,
  type PassbookEntry,
  type Trade,
  type WorkerOffer,
} from '../../lib/api';
import { useLoad } from '../../lib/session';
import { ComingSoonSheet } from '../profile/ComingSoonSheet';
import type { WorkerGo } from '../../screens/worker';
import { JobCard } from '../worker-jobs/JobCard';
import { setPendingTradeFilter } from '../worker-jobs/pendingTradeFilter';
import { withTimeout } from '../worker-jobs/fetchTimeout';
import { OnlineSwitchRow } from './OnlineSwitchRow';
import { HeroBanner } from './HeroBanner';
import { TradeIconRow } from './TradeIconRow';
import { TodaysOverview } from './TodaysOverview';
import { EarningsCard } from './EarningsCard';
import { SectionHead } from './SectionHead';
import styles from './HomeScreen.new.module.css';

const offerChip: Record<WorkerOffer['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Waiting', tone: 'orange' },
  accepted: { label: 'You got the job', tone: 'green' },
  rejected: { label: 'Not chosen', tone: 'plain' },
};

function workerNav(active: 'home' | 'jobs' | 'passbook' | 'profile', go: WorkerGo) {
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

function BookedJobCard({ entry, onOpen }: { entry: PassbookEntry; onOpen: () => void }) {
  return (
    <button type="button" className={styles.jobCard} onClick={onOpen}>
      <div className={styles.jobTop}>
        <StatusChip status={entry.job_status} />
        <strong className={styles.jobAmount}>
          {money(entry.agreed_total_amount, entry.currency)}
        </strong>
      </div>
      <h3 className={styles.jobTitle}>{tx(entry.problem_summary)}</h3>
      <p className={styles.jobMeta}>{t('Booked {when}', { when: when(entry.booked_at) })}</p>
      <JobSteps labels={stepLabels} {...stepsFor(entry.job_status)} />
    </button>
  );
}

export interface WorkerHomeScreenNewProps {
  workerId: string;
  go: WorkerGo;
  onOpenJob: (id: string) => void;
  onOpportunity: (o: Opportunity) => void;
}

export function WorkerHomeScreenNew({
  workerId,
  go,
  onOpenJob,
  onOpportunity,
}: WorkerHomeScreenNewProps) {
  const data = useLoad(
    () =>
      withTimeout(
        Promise.all([
          api.getWorker(workerId),
          api.passbook(workerId),
          api.workerOffers(workerId),
          api.opportunities(workerId),
        ]).then(([worker, passbook, offers, opportunities]) => ({
          worker,
          passbook,
          offers: offers.offers,
          opportunities,
        })),
      ),
    [workerId],
    10000,
  );

  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const openFindWork = (trade?: Trade) => {
    setPendingTradeFilter(trade ?? null);
    go.jobs();
  };

  if (!data.data) {
    return (
      <main className={`screen has-nav ${styles.root}`}>
        <header className={styles.head}>
          <div className={`${styles.skeleton}`} style={{ width: 48, height: 48, borderRadius: 999 }} />
          <div className={styles.identity}>
            <p className={styles.namaste}>{t('Namaste,')}</p>
            <div className={`${styles.skeleton}`} style={{ height: 18, width: '55%', borderRadius: 6 }} />
          </div>
        </header>
        <div className={`${styles.skeleton} ${styles.skHero}`} />
        <div className={`${styles.skeleton} ${styles.skStrip}`} />
        {data.error ? (
          <div className="mt-16">
            <ErrorNote error={data.error} onRetry={() => void data.reload()} />
          </div>
        ) : (
          <div className="mt-16"><Loading /></div>
        )}
        {workerNav('home', go)}
      </main>
    );
  }

  const { worker, passbook, offers, opportunities } = data.data;
  const s = passbook.summary;
  const current = passbook.entries.filter((e) => e.earning_status === 'in_progress');
  const fresh = opportunities.items.filter((o) => !o.has_active_offer).slice(0, 2);
  const jobsCount = opportunities.items.length;

  return (
    <main className={`screen has-nav ${styles.root}`}>
      <header className={styles.head}>
        {/* Worker API has no photo field — initials Avatar only. */}
        <button
          type="button"
          onClick={go.profile}
          aria-label={t('Profile')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Avatar name={worker.display_name} size={48} />
        </button>
        <div className={styles.identity}>
          <p className={styles.namaste}>{t('Namaste,')}</p>
          <h1 className={styles.name}>{worker.display_name}</h1>
        </div>
        <div className={styles.onlineWrap}>
          <OnlineSwitchRow
            workerId={workerId}
            available={worker.availability === 'available'}
            onChanged={() => void data.reload(true)}
          />
        </div>
      </header>

      <div className="mt-16">
        <HeroBanner jobsCount={jobsCount} onBrowseJobs={() => openFindWork()} />
      </div>

      <TradeIconRow
        onSelectTrade={(trade) => openFindWork(trade)}
        onMore={() => setComingSoonOpen(true)}
      />

      <TodaysOverview
        completedJobs={s.completed_jobs}
        activeJobs={s.active_jobs}
        radiusKm={worker.service_radius_km}
      />

      <EarningsCard
        currency={passbook.currency}
        confirmedEarnings={s.confirmed_earnings}
        paidDemo={s.simulated_settled_earnings}
        pendingCount={s.pending_settlements.count}
        pendingAmount={s.pending_settlements.amount}
        onOpenPassbook={go.passbook}
      />

      <SectionHead title={t('Your jobs')} />
      {current.length === 0 ? (
        <Empty
          icon={<Wrench size={20} />}
          title={t('No booked jobs right now')}
          text={t('When a customer books you, the job shows up here.')}
        />
      ) : (
        <div className={styles.jobStack}>
          {current.map((entry) => (
            <BookedJobCard
              key={entry.job_id}
              entry={entry}
              onOpen={() => onOpenJob(entry.job_id)}
            />
          ))}
        </div>
      )}

      <SectionHead
        title={t('My offers')}
        meta={t('{n} total', { n: offers.length })}
      />
      {offers.length === 0 ? (
        <Empty
          icon={<Send size={20} />}
          title={t('No offers sent yet')}
          text={t('Find a job nearby and send your price.')}
        />
      ) : (
        <div className={styles.offerList}>
          {offers.slice(0, 4).map((offer) => (
            <div key={offer.id} className={styles.offerRow}>
              <span className={styles.offerIcon} aria-hidden>
                <Send size={16} />
              </span>
              <div className={styles.offerBody}>
                <strong className={styles.offerTitle}>{tx(offer.problem_summary)}</strong>
                <small className={styles.offerMeta}>
                  {t('You offered {labour} + {travel} travel', {
                    labour: money(offer.labour_amount, offer.currency),
                    travel: money(offer.travel_allowance, offer.currency),
                  })}
                  {' · '}
                  {when(offer.created_at)}
                </small>
              </div>
              <Chip tone={offerChip[offer.status].tone}>
                {t(offerChip[offer.status].label)}
              </Chip>
            </div>
          ))}
        </div>
      )}

      <SectionHead
        title={t('New jobs near you')}
        actionLabel={t('See all')}
        onAction={() => openFindWork()}
      />
      {fresh.length === 0 ? (
        <Empty
          icon={<BriefcaseBusiness size={20} />}
          title={t('No new jobs right now')}
          text={
            opportunities.limitations[0]
              ? t(opportunities.limitations[0])
              : t('New jobs that match your trade and area will appear here.')
          }
        />
      ) : (
        <div className={styles.snapRow}>
          {fresh.map((o) => (
            <JobCard
              key={o.job_id}
              item={o}
              snap
              onOpen={() => onOpportunity(o)}
              onApply={() => onOpportunity(o)}
            />
          ))}
        </div>
      )}

      {workerNav('home', go)}

      <ComingSoonSheet
        open={comingSoonOpen}
        title={t('More trades')}
        onClose={() => setComingSoonOpen(false)}
      />
    </main>
  );
}
