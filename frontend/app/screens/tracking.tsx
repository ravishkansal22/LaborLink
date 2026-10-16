'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bike, ChevronRight, CircleCheck, Clock, House, MapPin, Navigation, Wrench } from 'lucide-react';
import { LiveMap, googleMapsUrl, type LatLng } from '../components/live-map';
import { SwipeButton } from '../components/swipe';
import { Avatar, ErrorNote, Loading } from '../components/ui';
import { api, money, tradeNames, type Tracking } from '../lib/api';
import { SPEED_KMH, etaMinutes, fetchRoute, pointAlong, remainingKm, type Pt, type Route } from '../lib/route';
import { useLoad } from '../lib/session';

const SHEET_INSET = 290; // keeps the map's points above the bottom sheet

function first(name: string) { return name.trim().split(/\s+/)[0]; }
function agoText(seconds: number) {
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

/** Fetches the road route once, from the first known position of the worker. */
function useRoute(from: LatLng | null, to: LatLng | null) {
  const [route, setRoute] = useState<Route | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !from || !to) return;
    asked.current = true;
    void fetchRoute([from.latitude, from.longitude], [to.latitude, to.longitude]).then(setRoute);
  }, [from, to]);
  return route;
}

/* ------------------------------------------------------------------ employer: watch the worker come */

export function EmployerTrackScreen({ jobId, employerId, onBack }: { jobId: string; employerId: string; onBack: () => void }) {
  const data = useLoad(async () => {
    const [job, booking] = await Promise.all([api.getJob(jobId), api.booking(jobId)]);
    const live = job.status === 'booked' || job.status === 'in_progress';
    return { job, booking, tracking: live ? await api.tracking(jobId, employerId) : null };
  }, [jobId], 4000);

  const t = data.data?.tracking ?? null;
  const here = t?.worker_location ?? null;
  const dest = t?.destination ?? null;
  const route = useRoute(here, dest);

  if (!data.data) {
    return <main className="screen"><div className="track-top static"><button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button></div>
      {data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading label="Finding your worker…" />}</main>;
  }
  const { job, booking } = data.data;
  const name = first(booking.worker.display_name);
  const remaining = here && route ? remainingKm(route, [here.latitude, here.longitude]) : null;
  const km = remaining ?? (t?.distance_km != null ? t.distance_km * 1.3 : null);
  const eta = t?.arrived ? 0 : km != null ? etaMinutes(km) : t?.eta_minutes ?? null;
  const progress = route && remaining != null ? Math.min(1, Math.max(0, 1 - remaining / Math.max(route.km, 0.01))) : 0;

  let pill = `Waiting for ${name} to set off`;
  let headline = 'Not started yet';
  let sub = `You’ll see ${name} on the map as soon as they start the trip.`;
  if (job.status === 'in_progress') { pill = 'Work in progress'; headline = `${name} is working on it`; sub = 'You’ll be asked to check the work when it’s done.'; }
  else if (t?.arrived) { pill = `${name} has arrived`; headline = 'At your door'; sub = `${name} has reached your location.`; }
  else if (here && eta != null) { pill = `${name} is on the way`; headline = `Arriving in ${eta} min`; sub = `${km?.toFixed(1)} km away · updated ${agoText(here.age_seconds)}`; }
  if (here?.stale && !t?.arrived && job.status === 'booked') sub = `Location last updated ${agoText(here.age_seconds)} — ${name} may have lost signal.`;
  const over = !(job.status === 'booked' || job.status === 'in_progress');

  return (
    <main className="track-screen">
      <div className="track-map">
        <LiveMap worker={here} destination={dest} route={route?.points ?? null} bottomInset={SHEET_INSET} />
      </div>
      <div className="track-top">
        <button type="button" className="icon-btn floating" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <span className={`track-pill ${t?.arrived || job.status === 'in_progress' ? 'done' : here ? 'live' : ''}`}>
          {here && !t?.arrived && job.status === 'booked' && <span className="dot" />}{over ? 'This visit is over' : pill}
        </span>
      </div>

      <section className="sheet">
        <div className="sheet-handle" />
        {over ? (
          <>
            <h2 className="sheet-title">Live tracking has ended</h2>
            <p className="small">The worker has finished at your home. Check the work from the job page.</p>
            <button className="btn btn-primary mt-12" type="button" onClick={onBack}>Back to job</button>
          </>
        ) : (
          <>
            <div className="row spread">
              <div>
                <p className="small">{job.status === 'in_progress' ? 'Status' : t?.arrived ? 'Arrived' : 'Estimated arrival'}</p>
                <h2 className="sheet-title">{headline}</h2>
              </div>
              <span className={`sheet-icon ${t?.arrived ? 'done' : ''}`}>
                {job.status === 'in_progress' ? <Wrench size={22} /> : t?.arrived ? <CircleCheck size={22} /> : here ? <Bike size={22} /> : <Clock size={22} />}
              </span>
            </div>
            <p className="small mt-2">{sub}</p>
            {job.status === 'booked' && (
              <div className="journey mt-12">
                <Bike size={16} />
                <div className="journey-bar"><span style={{ width: `${(t?.arrived ? 1 : progress) * 100}%` }} /></div>
                <House size={16} />
              </div>
            )}
            <div className="person mt-16">
              <Avatar name={booking.worker.display_name} size={48} />
              <div className="grow">
                <strong>{booking.worker.display_name}</strong>
                <span>{booking.worker.trades.map((tr) => tradeNames[tr].en).join(', ')}{booking.worker.years_experience != null ? ` · ${booking.worker.years_experience} yrs` : ''}</span>
              </div>
              <div className="right"><strong className="amount">{money(booking.agreed_total_amount, booking.currency)}</strong><small className="small">agreed</small></div>
            </div>
            <div className="sheet-job mt-12">
              <MapPin size={14} />
              <span>{job.work_order.problem_summary} · {job.request.location.address ?? 'your location'}</span>
            </div>
            <div className="grid-2 mt-12">
              <button className="btn btn-small btn-secondary" type="button" onClick={onBack}>Job details</button>
              {dest && here && job.status === 'booked' && !t?.arrived ? (
                <a className="btn btn-small btn-secondary" href={googleMapsUrl(dest, here)} target="_blank" rel="noreferrer"><Navigation size={15} />Google Maps</a>
              ) : <span />}
            </div>
            {job.status === 'booked' && !t?.arrived && (
              <p className="tiny-note mt-10">
                {route?.source === 'road' ? `Arrival time is estimated from the road route at ${SPEED_KMH} km/h city speed.` : t?.eta_basis ?? ''}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/** Compact "worker on the way" banner for the employer's home and job pages. */
export function TrackBanner({ jobId, employerId, onOpen }: { jobId: string; employerId: string; onOpen: () => void }) {
  const tracking = useLoad(() => api.tracking(jobId, employerId), [jobId], 6000);
  const t = tracking.data;
  if (!t) return null;
  const name = first(t.worker_name);
  const here = t.worker_location;
  const title = t.job_status === 'in_progress' ? `${name} is working on your job`
    : t.arrived ? `${name} has arrived` : here ? `${name} is on the way` : `${name} is booked`;
  const detail = t.job_status === 'in_progress' ? 'Tap to see the job'
    : t.arrived ? 'At your door' : here && t.eta_minutes != null ? `Arriving in about ${t.eta_minutes} min` : 'Waiting for them to set off';
  return (
    <button type="button" className="track-banner" onClick={onOpen}>
      <span className="track-banner-icon">{t.arrived || t.job_status === 'in_progress' ? <CircleCheck size={20} /> : <Bike size={20} />}</span>
      <span className="grow"><strong>{title}</strong><small>{detail}</small></span>
      <span className="track-banner-cta">Track <ChevronRight size={16} /></span>
    </button>
  );
}

/* ------------------------------------------------------------------ worker: trip to the customer */

export function WorkerTripScreen({ jobId, workerId, onBack, onStarted }: { jobId: string; workerId: string; onBack: () => void; onStarted: () => void }) {
  const data = useLoad(async () => {
    const [job, booking, worker] = await Promise.all([api.getJob(jobId), api.booking(jobId), api.getWorker(workerId)]);
    return { job, booking, worker };
  }, [jobId]);
  const [mode, setMode] = useState<'gps' | 'demo' | 'blocked'>('gps');
  const [view, setView] = useState<Tracking | null>(null);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [starting, setStarting] = useState(false);
  const lastSent = useRef(0);

  const job = data.data?.job;
  const dest: LatLng | null = job && job.request.location.latitude != null && job.request.location.longitude != null
    ? { latitude: job.request.location.latitude, longitude: job.request.location.longitude } : null;
  const base: LatLng | null = data.data ? { latitude: data.data.worker.location.latitude, longitude: data.data.worker.location.longitude } : null;
  const route = useRoute(pos ?? (mode !== 'gps' ? base : null), dest);

  const send = useCallback(async (p: Pt, accuracy: number | null) => {
    setPos({ latitude: p[0], longitude: p[1] });
    try {
      setView(await api.shareLocation(jobId, { worker_id: workerId, latitude: p[0], longitude: p[1], accuracy_m: accuracy }));
      setError(null);
    } catch (err) { setError(err); }
  }, [jobId, workerId]);

  // Share the real GPS position (max one update every 4 s). Falls back to "blocked".
  useEffect(() => {
    if (mode !== 'gps') return undefined;
    if (!navigator.geolocation) { setMode('blocked'); return undefined; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - lastSent.current < 4000) return;
        lastSent.current = now;
        void send([p.coords.latitude, p.coords.longitude], Math.round(p.coords.accuracy));
      },
      () => setMode('blocked'),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [mode, send]);

  // Demo trip: ride along the road route from the worker's base to the job in about 75 s.
  useEffect(() => {
    if (mode !== 'demo' || !route) return undefined;
    const steps = 25;
    let step = 0;
    const tick = () => {
      void send(pointAlong(route, step / steps), 8);
      step += 1;
      if (step > steps) window.clearInterval(timer);
    };
    const timer = window.setInterval(tick, 3000);
    tick();
    return () => window.clearInterval(timer);
  }, [mode, route, send]);

  if (!data.data) {
    return <main className="screen">{data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading />}</main>;
  }
  const { booking } = data.data;
  const remaining = pos && route ? remainingKm(route, [pos.latitude, pos.longitude]) : route?.km ?? null;
  const arrived = view?.arrived ?? false;
  const eta = arrived ? 0 : remaining != null ? etaMinutes(remaining) : null;

  const start = async () => {
    setStarting(true);
    try { await api.startJob(jobId, workerId); onStarted(); } catch (err) { setError(err); setStarting(false); }
  };

  return (
    <main className="track-screen">
      <div className="track-map">
        <LiveMap worker={pos} destination={dest} route={route?.points ?? null} bottomInset={SHEET_INSET} />
      </div>
      <div className="track-top">
        <button type="button" className="icon-btn floating" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <span className={`track-pill ${pos ? 'live' : ''}`}>
          {pos && <span className="dot" />}
          {mode === 'demo' ? 'Demo trip · sharing location' : pos ? 'Sharing live location' : mode === 'blocked' ? 'Location is off' : 'Getting your location…'}
        </span>
      </div>

      <section className="sheet">
        <div className="sheet-handle" />
        <div className="row spread">
          <div>
            <p className="small">{arrived ? 'You’ve arrived' : 'Heading to the customer'}</p>
            <h2 className="sheet-title">{arrived ? 'At the customer’s home' : eta != null ? `${eta} min · ${remaining?.toFixed(1)} km` : 'Route loading…'}</h2>
          </div>
          <span className={`sheet-icon ${arrived ? 'done' : ''}`}>{arrived ? <CircleCheck size={22} /> : <Bike size={22} />}</span>
        </div>
        <div className="sheet-job mt-6"><MapPin size={14} /><span>{job!.request.location.address ?? 'Customer location'} · {money(booking.agreed_total_amount, booking.currency)}</span></div>

        {mode === 'blocked' && (
          <div className="blocked mt-10">
            <p className="small">Your location is off, so the customer can’t see you coming.</p>
            {dest && <button className="btn btn-small btn-secondary mt-6" type="button" onClick={() => setMode('demo')}>Run a demo trip instead</button>}
          </div>
        )}
        {Boolean(error) && <div className="mt-10"><ErrorNote error={error} /></div>}

        {dest && (
          <a className="btn btn-small btn-secondary mt-12" href={googleMapsUrl(dest, pos)} target="_blank" rel="noreferrer"><Navigation size={15} />Navigate in Google Maps</a>
        )}
        <div className="mt-12"><SwipeButton label="Swipe to start the job" busy={starting} onConfirm={() => void start()} /></div>
        <p className="tiny-note mt-6">Only swipe once you’ve reached the customer. Sharing stops when the job starts.</p>
      </section>
    </main>
  );
}
