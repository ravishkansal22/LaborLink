'use client';

import { useEffect, useState } from 'react';
import { Loading } from './components/ui';
import { api, ApiError, type Job, type Opportunity, type Trade } from './lib/api';
import { setLanguage, useTranslations } from './lib/i18n';
import { useSession, type Language, type Role } from './lib/session';
import { useLocation } from './lib/location';
import {
  EmployerHomeScreen, EmployerJobScreen, EmployerJobsScreen, EmployerProfileScreen, NewJobScreen, type EmployerGo,
} from './screens/employer';
import { EmployerTrackScreen, WorkerTripScreen } from './screens/tracking';
import { AccountScreen, PermissionsScreen, ProfileSetupScreen, WelcomeScreen } from './screens/onboarding';
import {
  CounterOfferScreen, FindWorkScreen, OpportunityScreen, PassbookScreen, WorkerHomeScreen, WorkerJobScreen, WorkerProfileScreen,
  type WorkerGo,
} from './screens/worker';

type Screen =
  | 'welcome' | 'account' | 'permissions' | 'setup'
  | 'home' | 'newJob' | 'employerJob' | 'track' | 'jobs' | 'profile'
  | 'workerHome' | 'findWork' | 'opportunity' | 'counter' | 'workerJob' | 'trip' | 'passbook' | 'workerProfile';
interface Route { screen: Screen; jobId?: string; opportunity?: Opportunity; trade?: Trade; role?: Role }

const employerTabs: Screen[] = ['home', 'jobs', 'profile', 'newJob'];
const workerTabs: Screen[] = ['workerHome', 'findWork', 'passbook', 'workerProfile'];

export default function App() {
  const { session, update, clear } = useSession();
  const [stack, setStack] = useState<Route[]>([]);
  const [role, setRole] = useState<Role>('employer');
  useTranslations(); // re-render the whole screen when translations arrive
  useEffect(() => { if (session) setLanguage(session.language); }, [session?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (route: Route) => setStack((s) => [...s, route]);
  const replace = (route: Route) => setStack((s) => [...s.slice(0, -1), route]);
  const reset = (route: Route) => setStack([route]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  // First screen: the signed-in dashboard, or onboarding. ?screen=passbook etc. jumps to a tab (for recording).
  useEffect(() => {
    if (!session || stack.length) return undefined;
    let cancelled = false;
    void (async () => {
      // A worker saved on this phone may no longer exist (e.g. the database was reset):
      // forget it instead of showing "Worker … was not found" everywhere.
      if (session.workerId) {
        const gone = await api.getWorker(session.workerId).then(
          () => false,
          (err: unknown) => err instanceof ApiError && err.status === 404,
        );
        if (cancelled) return;
        if (gone) {
          update({ workerId: null, role: session.role === 'worker' ? (session.employer ? 'employer' : null) : session.role });
          return; // the session change runs this effect again
        }
      }
      const requested = new URLSearchParams(window.location.search).get('screen') as Screen | null;
      if (session.role === 'worker' && session.workerId) {
        reset({ screen: requested && workerTabs.includes(requested) ? requested : 'workerHome' });
      } else if (session.role === 'employer' && session.employer) {
        reset({ screen: requested && employerTabs.includes(requested) ? requested : 'home' });
      } else {
        reset({ screen: 'welcome' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const route = stack[stack.length - 1];
  const { closePicker } = useLocation();
  useEffect(() => {
    document.getElementById('device-scroll')?.scrollTo({ top: 0 });
    closePicker(); // tab/route change must leave overlays inert
  }, [route, closePicker]);

  if (!session || !route) return <main className="screen"><Loading /></main>;

  const employerGo: EmployerGo = { home: () => reset({ screen: 'home' }), jobs: () => reset({ screen: 'jobs' }), profile: () => reset({ screen: 'profile' }) };
  const workerGo: WorkerGo = {
    home: () => reset({ screen: 'workerHome' }), jobs: () => reset({ screen: 'findWork' }),
    passbook: () => reset({ screen: 'passbook' }), profile: () => reset({ screen: 'workerProfile' }),
  };
  const signOut = () => { clear(); reset({ screen: 'welcome' }); };
  const toWorker = () => {
    if (session.workerId) { update({ role: 'worker' }); reset({ screen: 'workerHome' }); } else push({ screen: 'setup', role: 'worker' });
  };
  const toEmployer = () => {
    if (session.employer) { update({ role: 'employer' }); reset({ screen: 'home' }); } else push({ screen: 'setup', role: 'employer' });
  };
  const changeLanguage = (language: Language) => update({ language });
  const openEmployerJob = (jobId: string) => push({ screen: 'employerJob', jobId });
  const openWorkerJob = (jobId: string) => push({ screen: 'workerJob', jobId });

  switch (route.screen) {
    case 'welcome':
      return <WelcomeScreen language={session.language} setLanguage={(language) => update({ language })} onContinue={() => push({ screen: 'account' })} />;
    case 'account':
      return <AccountScreen role={role} setRole={setRole} onBack={back} onContinue={() => push({ screen: 'permissions' })} />;
    case 'permissions':
      return <PermissionsScreen onBack={back} onCoords={(coords) => update({ coords })} onContinue={() => push({ screen: 'setup', role })} />;
    case 'setup':
      return (
        <ProfileSetupScreen role={route.role ?? role} session={session} onBack={back}
          onEmployerReady={(p) => {
            update({ role: 'employer', employer: { ...p, employerId: `emp-${p.phone}` } });
            reset({ screen: 'home' });
          }}
          onWorkerReady={(workerId) => { update({ role: 'worker', workerId }); reset({ screen: 'workerHome' }); }} />
      );

    case 'home':
      return <EmployerHomeScreen session={session} go={employerGo} onNewJob={(trade) => push({ screen: 'newJob', trade })} onOpenJob={openEmployerJob}
        onTrack={(jobId) => push({ screen: 'track', jobId })} />;
    case 'newJob':
      return (
        <NewJobScreen session={session} initialTrade={route.trade} onBack={back}
          onCreated={(job: Job) => {
            update((s) => ({ jobIds: [job.id, ...s.jobIds.filter((id) => id !== job.id)] }));
            replace({ screen: 'employerJob', jobId: job.id });
          }} />
      );
    case 'employerJob':
      return <EmployerJobScreen session={session} jobId={route.jobId!} onBack={back} onNewJob={() => replace({ screen: 'newJob' })}
        onTrack={() => push({ screen: 'track', jobId: route.jobId })} />;
    case 'track':
      return <EmployerTrackScreen jobId={route.jobId!} employerId={session.employer!.employerId} onBack={back} />;
    case 'jobs':
      return <EmployerJobsScreen session={session} go={employerGo} onOpenJob={openEmployerJob} onNewJob={() => push({ screen: 'newJob' })} />;
    case 'profile':
      return <EmployerProfileScreen session={session} go={employerGo} onWorkerMode={toWorker} onSignOut={signOut} onLanguage={changeLanguage} />;

    case 'workerHome':
      return <WorkerHomeScreen workerId={session.workerId!} go={workerGo} onOpenJob={openWorkerJob} onOpportunity={(o) => push({ screen: 'opportunity', opportunity: o })} />;
    case 'findWork':
      return <FindWorkScreen workerId={session.workerId!} go={workerGo} onOpportunity={(o) => push({ screen: 'opportunity', opportunity: o })} />;
    case 'opportunity':
      return (
        <OpportunityScreen workerId={session.workerId!} opportunity={route.opportunity!} onBack={back}
          onCounter={() => push({ screen: 'counter', opportunity: route.opportunity })} onSent={() => reset({ screen: 'workerHome' })} />
      );
    case 'counter':
      return <CounterOfferScreen workerId={session.workerId!} opportunity={route.opportunity!} onBack={back} onSent={() => reset({ screen: 'workerHome' })} />;
    case 'workerJob':
      return <WorkerJobScreen workerId={session.workerId!} jobId={route.jobId!} onBack={back} onPassbook={() => reset({ screen: 'passbook' })}
        onTrip={() => push({ screen: 'trip', jobId: route.jobId })} />;
    case 'trip':
      return <WorkerTripScreen workerId={session.workerId!} jobId={route.jobId!} onBack={back} onStarted={back} />;
    case 'passbook':
      return <PassbookScreen workerId={session.workerId!} go={workerGo} onOpenJob={openWorkerJob} />;
    case 'workerProfile':
      return <WorkerProfileScreen workerId={session.workerId!} go={workerGo} onHireMode={toEmployer} onSignOut={signOut} hasEmployer={Boolean(session.employer)}
        language={session.language} onLanguage={changeLanguage} />;
  }
}
