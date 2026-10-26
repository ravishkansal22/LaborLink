'use client';

/**
 * New Find work. Gated by USE_NEW_FIND_WORK in screens/worker.tsx.
 * Same fetches / radius PATCH / opportunity open handlers as the legacy screen.
 * No map: Opportunity has distance_km but no lat/lng to plot.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  House,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { t } from '../../lib/i18n';
import {
  api,
  type Opportunity,
  type Trade,
} from '../../lib/api';
import { useLoad } from '../../lib/session';
import { useLocation } from '../../lib/location';
import { BottomNav, Empty, ErrorNote, Note } from '../ui';
import { LocationHeader } from '../location';
import type { WorkerGo } from '../../screens/worker';
import { OnlineSwitchRow } from '../worker-home/OnlineSwitchRow';
import { JobCard } from './JobCard';
import { JobCardSkeleton } from './JobCardSkeleton';
import { TradeChips, type TradeChipId } from './TradeChips';
import { SortMenu, type JobSortId } from './SortMenu';
import { FiltersSheet, type FindWorkFilters } from './FiltersSheet';
import { takePendingTradeFilter } from './pendingTradeFilter';
import { withTimeout } from './fetchTimeout';
import styles from './FindWorkScreen.new.module.css';

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

function sortJobs(items: Opportunity[], sort: JobSortId): Opportunity[] {
  const copy = [...items];
  if (sort === 'nearest') {
    copy.sort((a, b) => {
      const da = a.distance_km;
      const db = b.distance_km;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  } else if (sort === 'newest') {
    copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  } else {
    copy.sort(
      (a, b) =>
        b.offer_terms.suggested_labour_amount - a.offer_terms.suggested_labour_amount,
    );
  }
  return copy;
}

export interface FindWorkScreenNewProps {
  workerId: string;
  go: WorkerGo;
  onOpportunity: (o: Opportunity) => void;
}

export function FindWorkScreenNew({
  workerId,
  go,
  onOpportunity,
}: FindWorkScreenNewProps) {
  const { openPicker } = useLocation();
  const data = useLoad(
    () =>
      withTimeout(
        Promise.all([api.getWorker(workerId), api.opportunities(workerId)]).then(
          ([worker, opportunities]) => ({ worker, opportunities }),
        ),
      ),
    [workerId],
    10000,
  );

  const [chip, setChip] = useState<TradeChipId>('all');
  const [sort, setSort] = useState<JobSortId>('nearest');
  const [filters, setFilters] = useState<FindWorkFilters>({
    trades: [],
    maxDistanceKm: null,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [radiusSaving, setRadiusSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded) return;
    const pending = takePendingTradeFilter();
    if (pending) {
      setChip(pending);
      setFilters((f) => ({ ...f, trades: [pending] }));
    }
    setSeeded(true);
  }, [seeded]);

  const setRadius = async (km: number) => {
    setRadiusSaving(true);
    try {
      await api.updateWorker(workerId, { service_radius_km: km });
      await data.reload(true);
    } finally {
      setRadiusSaving(false);
    }
  };

  const onChipChange = (id: TradeChipId) => {
    setChip(id);
    setFilters((f) => ({
      ...f,
      trades: id === 'all' ? [] : [id as Trade],
    }));
  };

  const onFiltersChange = (next: FindWorkFilters) => {
    setFilters(next);
    if (next.trades.length === 1) setChip(next.trades[0]);
    else if (next.trades.length === 0) setChip('all');
    else setChip('all');
  };

  const rawItems = data.data?.opportunities.items;
  const filtersActive =
    filters.trades.length > 0 || filters.maxDistanceKm != null;

  const filtered = useMemo(() => {
    let items = rawItems ?? [];
    if (filters.trades.length > 0) {
      items = items.filter((o) => filters.trades.includes(o.trade));
    } else if (chip !== 'all') {
      items = items.filter((o) => o.trade === chip);
    }
    if (filters.maxDistanceKm != null) {
      const max = filters.maxDistanceKm;
      items = items.filter((o) => o.distance_km != null && o.distance_km <= max);
    }
    return sortJobs(items, sort);
  }, [rawItems, filters, chip, sort]);

  const clearFilters = () => {
    setFilters({ trades: [], maxDistanceKm: null });
    setChip('all');
  };

  return (
    <main className={`screen has-nav ${styles.root}`}>
      <header className={styles.head}>
        <LocationHeader onClick={() => openPicker()} />
        <button
          type="button"
          className={styles.filtersBtn}
          aria-label={t('Filters')}
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal size={20} strokeWidth={2} aria-hidden />
        </button>
      </header>

      {!data.data ? (
        <>
          <div className={styles.chipsSk} aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.chipSk} />
            ))}
          </div>
          {data.error ? (
            <div className="mt-16">
              <ErrorNote error={data.error} onRetry={() => void data.reload()} />
            </div>
          ) : (
            <div className={styles.list} aria-busy="true" aria-label={t('Loading jobs')}>
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.onlineRow}>
            <OnlineSwitchRow
              workerId={workerId}
              available={data.data.worker.availability === 'available'}
              onChanged={() => void data.reload(true)}
            />
          </div>

          <TradeChips value={chip} onChange={onChipChange} />

          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{t('Available jobs near you')}</h2>
            <SortMenu value={sort} onChange={setSort} />
          </div>

          {(rawItems?.length ?? 0) === 0 ? (
            <Empty
              icon={<BriefcaseBusiness size={20} />}
              title={t('No new jobs right now')}
              text={
                data.data.opportunities.limitations[0]
                  ? t(data.data.opportunities.limitations[0])
                  : t('Try a bigger radius, or check back soon.')
              }
            />
          ) : filtered.length === 0 ? (
            <div className={styles.emptyFilters}>
              <Empty
                icon={<BriefcaseBusiness size={20} />}
                title={t('No jobs match your filters')}
                text={t('Try another trade or clear filters.')}
              />
              {filtersActive && (
                <button type="button" className={styles.clearBtn} onClick={clearFilters}>
                  {t('Clear filters')}
                </button>
              )}
            </div>
          ) : (
            <div className={styles.list}>
              {filtered.map((o) => (
                <JobCard
                  key={o.job_id}
                  item={o}
                  onOpen={() => onOpportunity(o)}
                  onApply={() => onOpportunity(o)}
                />
              ))}
            </div>
          )}

          <div className="mt-16">
            <Note>
              <strong>{t('FairRate')}</strong>{' '}
              {t('Offers must stay inside each job’s range, so nobody can undercut your rate.')}
            </Note>
          </div>

          <FiltersSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            filters={filters}
            onChangeFilters={onFiltersChange}
            serviceRadiusKm={data.data.worker.service_radius_km}
            onChangeRadius={(km) => void setRadius(km)}
            radiusSaving={radiusSaving}
          />
        </>
      )}

      {workerNav('jobs', go)}
    </main>
  );
}
