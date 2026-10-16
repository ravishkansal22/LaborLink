'use client';

import { useCallback, useState } from 'react';
import {
  ArrowRight, BadgeCheck, BrickWall, BriefcaseBusiness, ChevronRight, CircleCheck, ClipboardList, Droplets, Hammer, House,
  LogOut, MapPin, Mic, MicOff, Navigation, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert, UserRound, Users, Wallet, Zap,
} from 'lucide-react';
import {
  AppBar, Avatar, BottomNav, Chip, Empty, ErrorNote, JobSteps, Loading, Note, Photo, PhotoPicker, SettingRow, StatusChip,
  stepLabels, stepsFor, type PickedPhoto,
} from '../components/ui';
import { TrackBanner } from './tracking';
import { allTrades, api, capitalise, hours, money, tradeNames, when, type Job, type Trade, type Urgency } from '../lib/api';
import { useLoad, useSpeech, type Session } from '../lib/session';

const tradeIcons: Record<Trade, JSX.Element> = {
  electrician: <Zap size={20} />, plumber: <Droplets size={20} />, mason: <BrickWall size={20} />, carpenter: <Hammer size={20} />,
};
const finished = (job: Job) => job.status === 'completed' || job.status === 'disputed';

export type EmployerGo = { home: () => void; jobs: () => void; profile: () => void };
function employerNav(active: 'home' | 'jobs' | 'profile', go: EmployerGo) {
  return (
    <BottomNav items={[
      { label: 'Home', icon: <House size={22} />, active: active === 'home', onClick: go.home },
      { label: 'My jobs', icon: <BriefcaseBusiness size={22} />, active: active === 'jobs', onClick: go.jobs },
      { label: 'Profile', icon: <UserRound size={22} />, active: active === 'profile', onClick: go.profile },
    ]} />
  );
}

/** Loads every job this employer posted from this device. Missing jobs (e.g. a reset database) are skipped. */
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
    <button type="button" className="card job-card" onClick={onOpen}>
      <div className="row spread"><StatusChip status={job.status} /><span className="small">{when(job.updated_at)}</span></div>
      <h3 className="h4 mt-10">{job.work_order.problem_summary}</h3>
      <p className="small">{job.trade ? tradeNames[job.trade].en : 'Trade not decided'} · {estimate ? `${money(estimate.min_amount)}–${money(estimate.max_amount)}` : 'No price yet'}</p>
      {!['estimated', 'needs_information'].includes(job.status) && <JobSteps labels={stepLabels} {...steps} />}
    </button>
  );
}

/* ------------------------------------------------------------------ home */

export function EmployerHomeScreen({ session, go, onNewJob, onOpenJob, onTrack }: {
  session: Session; go: EmployerGo; onNewJob: (trade?: Trade) => void; onOpenJob: (id: string) => void; onTrack: (id: string) => void;
}) {
  const jobs = useMyJobs(session, 10000);
  const active = (jobs.data ?? []).filter((j) => !finished(j));
  const onTheWay = active.filter((j) => j.status === 'booked' || j.status === 'in_progress');
  const employer = session.employer!;
  return (
    <main className="screen has-nav">
      <header className="home-head">
        <div className="location-btn">
          <MapPin size={16} />
          <span><small>Your location</small><strong>{employer.address}</strong></span>
        </div>
        <button type="button" onClick={go.profile} aria-label="Profile" className="plain"><Avatar name={employer.name} size={36} /></button>
      </header>

      {onTheWay.map((j) => (
        <div key={j.id} className="mt-12"><TrackBanner jobId={j.id} employerId={employer.employerId} onOpen={() => onTrack(j.id)} /></div>
      ))}

      <h1 className="h1 mt-12">Namaste, {employer.name.split(' ')[0]}</h1>
      <p className="body mt-2">What needs fixing today?</p>

      <section className="card mt-16">
        <h2 className="h3">Describe the problem</h2>
        <p className="small mt-2">Add a photo and say or type what’s wrong. You’ll get a clear job description and a fair price range.</p>
        <button type="button" className="btn btn-primary mt-12" onClick={() => onNewJob()}><Mic size={18} />Describe a new job</button>
      </section>

      <div className="section-head"><h2 className="h3">Book a worker</h2></div>
      <div className="grid-2">
        {allTrades.map((trade) => (
          <button key={trade} type="button" className="trade-tile" onClick={() => onNewJob(trade)}>
            <span className="tile-icon">{tradeIcons[trade]}</span>
            <span><strong>{tradeNames[trade].en}</strong><small>{tradeNames[trade].hi}</small></span>
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2 className="h3">Your active jobs</h2>
        {active.length > 0 && <button className="link-btn" type="button" onClick={go.jobs}>All jobs <ChevronRight size={15} /></button>}
      </div>
      {jobs.loading && !jobs.data ? <Loading /> : jobs.error ? <ErrorNote error={jobs.error} onRetry={() => void jobs.reload()} /> : active.length === 0 ? (
        <Empty icon={<ClipboardList size={20} />} title="No active jobs" text="Describe a problem to get a price range and offers from workers nearby." />
      ) : (
        <div className="stack">{active.slice(0, 3).map((job) => <JobCard key={job.id} job={job} onOpen={() => onOpenJob(job.id)} />)}</div>
      )}

      {employerNav('home', go)}
    </main>
  );
}

/* ------------------------------------------------------------------ new job */

export function NewJobScreen({ session, initialTrade, onBack, onCreated }: { session: Session; initialTrade?: Trade; onBack: () => void; onCreated: (job: Job) => void }) {
  const employer = session.employer!;
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [description, setDescription] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(initialTrade ?? null);
  const [urgency, setUrgency] = useState<Urgency>('normal');
  const [address, setAddress] = useState(employer.address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onText = useCallback((text: string) => {
    setUsedVoice(true);
    setDescription((current) => (current ? `${current} ${text}` : text));
  }, []);
  const speech = useSpeech(session.language, onText);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const job = await api.createJob({
        description: description.trim(),
        description_source: usedVoice ? 'voice_transcript' : 'text',
        language: session.language,
        trade,
        urgency,
        location: { address: address.trim() || null, latitude: employer.latitude, longitude: employer.longitude },
        image_id: photos[0]?.id ?? null,
        employer_id: employer.employerId,
      });
      onCreated(job);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <main className="screen">
      <AppBar title="New job" subtitle="Describe the problem" onBack={onBack} />
      <h1 className="h1">What’s wrong?</h1>
      <p className="body mt-6">Speak in Hindi, English or a mix, or type it. Add a photo if you can.</p>

      <section className="card mt-16">
        <div className="row spread">
          <label className="field-label" htmlFor="description">Description</label>
          {speech.supported && (
            <button type="button" className={`mic-chip ${speech.listening ? 'on' : ''}`} onClick={speech.listening ? speech.stop : speech.start}>
              {speech.listening ? <><span className="dot" />Listening — tap to stop</> : <><Mic size={15} />Speak</>}
            </button>
          )}
        </div>
        <textarea id="description" className="text-area" rows={4} maxLength={2000} value={description}
          placeholder="e.g. Bathroom pump switch trips the MCB every time it’s turned on"
          onChange={(e) => setDescription(e.target.value)} />
        {!speech.supported && <p className="small with-icon mt-6"><MicOff size={13} />Voice input needs Chrome or Edge. You can type instead.</p>}
        {speech.problem && <p className="small danger mt-6">{speech.problem}</p>}
      </section>

      <p className="field-label mt-16">Photo of the problem <span className="tiny-tag">optional</span></p>
      <PhotoPicker photos={photos} onChange={setPhotos} max={1} label="Photo" />

      <p className="field-label mt-16">Who do you need?</p>
      <div className="tag-row">
        <button type="button" className={`tag ${trade === null ? 'on' : ''}`} onClick={() => setTrade(null)}><Sparkles size={14} />Not sure</button>
        {allTrades.map((t) => <button key={t} type="button" className={`tag ${trade === t ? 'on' : ''}`} onClick={() => setTrade(t)}>{tradeNames[t].en}</button>)}
      </div>

      <p className="field-label mt-16">When?</p>
      <div className="segmented three">
        {(['flexible', 'normal', 'urgent'] as Urgency[]).map((u) => (
          <button key={u} type="button" className={urgency === u ? 'on' : ''} onClick={() => setUrgency(u)}>
            {{ flexible: 'Flexible', normal: 'Today', urgent: 'Urgent' }[u]}
          </button>
        ))}
      </div>

      <label className="field-label mt-16" htmlFor="address">Address</label>
      <input id="address" className="input" value={address} maxLength={500} onChange={(e) => setAddress(e.target.value)} />

      {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}
      <div className="push-bottom">
        <button className="btn btn-primary" type="button" disabled={saving || description.trim().length < 3} onClick={() => void submit()}>
          {saving ? 'Getting your price…' : <>Get price estimate <ArrowRight size={18} /></>}
        </button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ one job, driven by its live status */

export function EmployerJobScreen({ session, jobId, onBack, onNewJob, onTrack }: {
  session: Session; jobId: string; onBack: () => void; onNewJob: () => void; onTrack: () => void;
}) {
  const employer = session.employer!;
  const job = useLoad(() => api.getJob(jobId), [jobId], 5000);
  if (!job.data) {
    return (
      <main className="screen"><AppBar title="Job" onBack={onBack} />
        {job.error ? <ErrorNote error={job.error} onRetry={() => void job.reload()} /> : <Loading />}
      </main>
    );
  }
  const j = job.data;
  const estimate = j.price_estimate;
  const wo = j.work_order;
  const refresh = () => void job.reload(true);
  const early = j.status === 'estimated' || j.status === 'needs_information';
  const priceCard = estimate && (
    <section className="card price-card mt-16">
      <p className="small">Fair price for this job</p>
      <strong className="big-amount">{money(estimate.min_amount, estimate.currency)} – {money(estimate.max_amount, estimate.currency)}</strong>
      <p className="small mt-2">Labour {money(estimate.labour.min)}–{money(estimate.labour.max)} · travel {money(estimate.travel_allowance)} · about {hours(estimate.duration_hours)}</p>
      <details className="details mt-10">
        <summary>How we worked it out</summary>
        <ul className="bullets">{estimate.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        {estimate.warnings.length > 0 && <><p className="field-label mt-6">Keep in mind</p><ul className="bullets">{estimate.warnings.map((w) => <li key={w}>{w}</li>)}</ul></>}
      </details>
    </section>
  );

  return (
    <main className="screen">
      <AppBar title="Job" subtitle={`#${j.id.slice(0, 8)} · posted ${when(j.created_at)}`} onBack={onBack} />
      <StatusChip status={j.status} />
      <h1 className="h1 mt-10">{wo.problem_summary}</h1>
      <p className="small with-icon mt-6"><MapPin size={13} />{j.request.location.address ?? 'Location from map'}</p>
      {!['estimated', 'needs_information'].includes(j.status) && <JobSteps labels={stepLabels} {...stepsFor(j.status)} />}

      {early && priceCard}

      {j.status === 'needs_information' && (
        <section className="card mt-16">
          <h2 className="h4 with-icon"><TriangleAlert size={16} />We need a bit more detail</h2>
          <ul className="bullets mt-6">{wo.missing_information.map((m) => <li key={m}>{m}</li>)}</ul>
          <button className="btn btn-primary mt-12" type="button" onClick={onNewJob}>Describe it again</button>
        </section>
      )}

      {j.status === 'estimated' && <OffersSection jobId={j.id} employerId={employer.employerId} onBooked={onTrack} />}
      {(j.status === 'booked' || j.status === 'in_progress') && (
        <div className="mt-12"><TrackBanner jobId={j.id} employerId={employer.employerId} onOpen={onTrack} /></div>
      )}
      {['booked', 'in_progress', 'awaiting_confirmation', 'completed', 'disputed'].includes(j.status) && <BookingCard jobId={j.id} status={j.status} />}
      {j.status === 'awaiting_confirmation' && <ReviewSection jobId={j.id} employerId={employer.employerId} onDone={refresh} />}
      {j.status === 'completed' && <SettlementSection jobId={j.id} employerId={employer.employerId} />}
      {j.status === 'disputed' && (
        <div className="mt-12"><Note>You reported a problem with this job, so it won’t be paid. Sorting out disputes isn’t part of this prototype yet.</Note></div>
      )}

      {!early && priceCard}

      <section className="card mt-12">
        <h2 className="h4">Your request</h2>
        <blockquote className="quote mt-6">“{j.request.description}”</blockquote>
        <div className="tag-row mt-10">
          {j.trade && <Chip tone="green">{tradeNames[j.trade].en}</Chip>}
          <Chip>{capitalise(j.request.urgency)}</Chip>
          {j.request.description_source === 'voice_transcript' && <Chip icon={<Mic size={12} />}>Voice</Chip>}
          <Chip>{capitalise(wo.complexity)} complexity</Chip>
        </div>
        {j.request.image_id && <div className="grid-2 mt-10"><Photo src={api.imageUrl(j.request.image_id)} label="Your photo" /></div>}
        {(wo.likely_tools.length > 0 || wo.likely_materials.length > 0) && (
          <>
            <p className="field-label mt-12">The worker will likely need</p>
            <div className="tag-row">{[...wo.likely_tools, ...wo.likely_materials].map((t) => <span key={t} className="tag">{t}</span>)}</div>
          </>
        )}
        {wo.follow_up_questions.length > 0 && (
          <>
            <p className="field-label mt-12">Questions the worker may ask</p>
            <ul className="bullets">{wo.follow_up_questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </>
        )}
      </section>
    </main>
  );
}

function OffersSection({ jobId, employerId, onBooked }: { jobId: string; employerId: string; onBooked: () => void }) {
  const matches = useLoad(() => api.matches(jobId), [jobId], 15000);
  const offers = useLoad(() => api.jobOffers(jobId), [jobId], 5000);
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const book = async (offerId: string) => {
    setBooking(offerId);
    setError(null);
    try { await api.book(jobId, offerId, employerId); onBooked(); } catch (err) { setError(err); setBooking(null); void offers.reload(true); }
  };
  const pending = (offers.data?.offers ?? []).filter((o) => o.status === 'pending');
  const terms = offers.data?.offer_terms;

  return (
    <>
      <div className="section-head"><h2 className="h3">Offers</h2><span className="small with-icon"><RefreshCw size={12} />Live</span></div>
      {terms && <p className="small">Workers can offer {money(terms.permitted_min)}–{money(terms.permitted_max)} for labour, plus {money(terms.travel_allowance)} travel.</p>}
      {Boolean(error) && <div className="mt-6"><ErrorNote error={error} /></div>}
      {offers.loading && !offers.data ? <Loading /> : offers.error ? <ErrorNote error={offers.error} onRetry={() => void offers.reload()} /> : pending.length === 0 ? (
        <div className="mt-6"><Empty icon={<Send size={20} />} title="No offers yet" text="Workers who match your job can see it now. Offers appear here as they come in." /></div>
      ) : (
        <div className="stack mt-6">
          {pending.map((offer) => (
            <article key={offer.id} className="card">
              <div className="person">
                <Avatar name={offer.worker.display_name} size={46} />
                <div className="grow">
                  <strong>{offer.worker.display_name}</strong>
                  <span>{offer.worker.trades.map((t) => tradeNames[t].en).join(', ')}{offer.worker.years_experience != null ? ` · ${offer.worker.years_experience} yrs` : ''}</span>
                  <span>{offer.distance_km != null ? `${offer.distance_km} km away` : 'Distance unknown'} · {offer.kind === 'counter' ? 'Counter offer' : 'Accepted your price'}</span>
                </div>
                <div className="right"><strong className="offer-price">{money(offer.total_amount)}</strong><small className="small">incl. travel</small></div>
              </div>
              {offer.message && <p className="quote mt-10">“{offer.message}”</p>}
              {!offer.currently_eligible && <p className="small danger mt-6">{offer.eligibility_issues.join(' ')}</p>}
              <button className="btn btn-small btn-primary mt-12" type="button" disabled={booking !== null || !offer.currently_eligible} onClick={() => void book(offer.id)}>
                {booking === offer.id ? 'Booking…' : `Book ${offer.worker.display_name.split(' ')[0]} for ${money(offer.total_amount)}`}
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="section-head"><h2 className="h3">Workers who fit</h2>{matches.data && <span className="small">{matches.data.candidates.length} found</span>}</div>
      {matches.error ? <ErrorNote error={matches.error} onRetry={() => void matches.reload()} /> : !matches.data ? <Loading /> : matches.data.candidates.length === 0 ? (
        <Empty icon={<Users size={20} />} title="No available workers nearby yet" text={matches.data.limitations.join(' ') || 'Try again a little later.'} />
      ) : (
        <div className="list">
          {matches.data.candidates.map((c) => (
            <div key={c.worker.id} className="list-row align-start">
              <Avatar name={c.worker.display_name} size={38} />
              <div className="grow">
                <strong className="h4">{c.worker.display_name}</strong>
                <small className="small block">{c.reasons.slice(2).join(' · ') || c.reasons.join(' · ')}</small>
              </div>
              <span className="small">{c.distance_km != null ? `${c.distance_km} km` : '—'}</span>
            </div>
          ))}
        </div>
      )}
      {matches.data?.distance_matching === 'unavailable' && <div className="mt-6"><Note>{matches.data.limitations[0]}</Note></div>}
    </>
  );
}

function BookingCard({ jobId, status }: { jobId: string; status: Job['status'] }) {
  const booking = useLoad(() => api.booking(jobId), [jobId, status]);
  if (booking.error) return <div className="mt-12"><ErrorNote error={booking.error} onRetry={() => void booking.reload()} /></div>;
  if (!booking.data) return <Loading />;
  const b = booking.data;
  const waitingText: Partial<Record<Job['status'], string>> = {
    booked: `${b.worker.display_name.split(' ')[0]} will start the job when they arrive.`,
    in_progress: `${b.worker.display_name.split(' ')[0]} is working on it. You’ll be asked to check the photos when it’s done.`,
  };
  return (
    <section className="card mt-16">
      <div className="person">
        <Avatar name={b.worker.display_name} size={46} />
        <div className="grow">
          <strong>{b.worker.display_name}</strong>
          <span>{b.worker.trades.map((t) => tradeNames[t].en).join(', ')}{b.worker.years_experience != null ? ` · ${b.worker.years_experience} yrs` : ''}</span>
          <span>Booked {when(b.created_at)}</span>
        </div>
        <div className="right"><strong className="offer-price">{money(b.agreed_total_amount, b.currency)}</strong><small className="small">agreed</small></div>
      </div>
      {waitingText[status] && <p className="small mt-10">{waitingText[status]}</p>}
    </section>
  );
}

function ReviewSection({ jobId, employerId, onDone }: { jobId: string; employerId: string; onDone: () => void }) {
  const evidence = useLoad(() => api.evidence(jobId), [jobId]);
  const [mode, setMode] = useState<'view' | 'dispute'>('view');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const decide = async (decision: 'confirm' | 'dispute') => {
    setSaving(true);
    setError(null);
    try { await api.review(jobId, employerId, decision, reason.trim()); onDone(); } catch (err) { setError(err); setSaving(false); }
  };

  return (
    <>
      <div className="section-head"><h2 className="h3">Check the work</h2></div>
      {evidence.error ? <ErrorNote error={evidence.error} onRetry={() => void evidence.reload()} /> : !evidence.data ? <Loading /> : (
        <section className="card">
          <p className="small">Sent {when(evidence.data.submitted_at)}</p>
          <div className="grid-2 mt-10">
            {evidence.data.before_images.map((img, i) => <Photo key={img.image_id} src={api.imageUrl(img.image_id)} label={`Before ${i + 1}`} tag="Before" />)}
            {evidence.data.after_images.map((img, i) => <Photo key={img.image_id} src={api.imageUrl(img.image_id)} label={`After ${i + 1}`} tag="After" />)}
          </div>
          {evidence.data.note && <blockquote className="quote mt-10">“{evidence.data.note}”</blockquote>}
          <p className="small mt-10">{evidence.data.disclaimer}</p>
        </section>
      )}
      {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}
      {mode === 'view' ? (
        <>
          <button className="btn btn-primary mt-16" type="button" disabled={saving || !evidence.data} onClick={() => void decide('confirm')}>
            <ShieldCheck size={18} />{saving ? 'Saving…' : 'Work is done — confirm'}
          </button>
          <button className="btn btn-ghost danger mt-6" type="button" disabled={saving} onClick={() => setMode('dispute')}>Something’s wrong — report a problem</button>
        </>
      ) : (
        <section className="card mt-16">
          <label className="field-label" htmlFor="reason">What’s wrong?</label>
          <textarea id="reason" className="text-area" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The MCB still trips when the pump starts" />
          <p className="small mt-6">The job won’t be paid while a problem is open.</p>
          <div className="grid-2 mt-12">
            <button className="btn btn-small btn-secondary" type="button" onClick={() => setMode('view')}>Cancel</button>
            <button className="btn btn-small btn-danger" type="button" disabled={saving || reason.trim().length < 5} onClick={() => void decide('dispute')}>Report problem</button>
          </div>
        </section>
      )}
    </>
  );
}

function SettlementSection({ jobId, employerId }: { jobId: string; employerId: string }) {
  const settlement = useLoad(() => api.settlement(jobId), [jobId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pay = async () => {
    setSaving(true);
    setError(null);
    try { await api.settle(jobId, employerId); await settlement.reload(true); } catch (err) { setError(err); } finally { setSaving(false); }
  };
  if (settlement.error) return <div className="mt-12"><ErrorNote error={settlement.error} onRetry={() => void settlement.reload()} /></div>;
  if (!settlement.data) return <Loading />;
  const s = settlement.data;
  const paid = s.status === 'simulated_settled';
  return (
    <section className="card mt-12">
      <div className="row spread"><h2 className="h4 with-icon"><Wallet size={16} />Payment</h2>{paid ? <Chip tone="green" icon={<CircleCheck size={12} />}>Paid (demo)</Chip> : <Chip tone="orange">Due</Chip>}</div>
      <div className="lines mt-6">
        <p><span>Labour</span><strong>{money(s.labour_amount, s.currency)}</strong></p>
        <p><span>Travel</span><strong>{money(s.travel_allowance, s.currency)}</strong></p>
        <p className="total"><span>Total</span><strong>{money(s.amount, s.currency)}</strong></p>
      </div>
      {paid && s.settled_at && <p className="small mt-6">Paid {when(s.settled_at)}</p>}
      {Boolean(error) && <div className="mt-6"><ErrorNote error={error} /></div>}
      {!paid && <button className="btn btn-primary mt-12" type="button" disabled={saving} onClick={() => void pay()}>{saving ? 'Paying…' : `Pay ${money(s.amount, s.currency)} (demo)`}</button>}
      <p className="small mt-10">{s.disclaimer}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ my jobs & profile */

export function EmployerJobsScreen({ session, go, onOpenJob, onNewJob }: { session: Session; go: EmployerGo; onOpenJob: (id: string) => void; onNewJob: () => void }) {
  const jobs = useMyJobs(session, 10000);
  const [tab, setTab] = useState<'ongoing' | 'done'>('ongoing');
  const all = jobs.data ?? [];
  const shown = all.filter((j) => (tab === 'done' ? finished(j) : !finished(j)));
  return (
    <main className="screen has-nav">
      <AppBar title="My jobs" right={<span className="appbar-spacer" />} />
      <div className="segmented">
        <button type="button" className={tab === 'ongoing' ? 'on' : ''} onClick={() => setTab('ongoing')}>Ongoing ({all.filter((j) => !finished(j)).length})</button>
        <button type="button" className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Finished ({all.filter(finished).length})</button>
      </div>
      <div className="mt-16">
        {jobs.loading && !jobs.data ? <Loading /> : jobs.error ? <ErrorNote error={jobs.error} onRetry={() => void jobs.reload()} /> : shown.length === 0 ? (
          <Empty icon={<ClipboardList size={20} />} title={tab === 'done' ? 'Nothing finished yet' : 'No ongoing jobs'}
            text={tab === 'done' ? 'Completed jobs and their payments will show here.' : 'Describe a problem to get a price and offers.'}
            action={tab === 'ongoing' ? <button className="btn btn-small btn-primary mt-10" type="button" onClick={onNewJob}>Describe a new job</button> : undefined} />
        ) : (
          <div className="stack">{shown.map((job) => <JobCard key={job.id} job={job} onOpen={() => onOpenJob(job.id)} />)}</div>
        )}
      </div>
      {employerNav('jobs', go)}
    </main>
  );
}

export function EmployerProfileScreen({ session, go, onWorkerMode, onSignOut }: { session: Session; go: EmployerGo; onWorkerMode: () => void; onSignOut: () => void }) {
  const e = session.employer!;
  return (
    <main className="screen has-nav">
      <AppBar title="Profile" right={<span className="appbar-spacer" />} />
      <section className="profile-head">
        <Avatar name={e.name} size={64} />
        <div>
          <h2 className="h2">{e.name}</h2>
          <p className="small">Employer · +91 {e.phone}</p>
          <span className="row gap-4 small mt-2"><BadgeCheck size={14} className="muted" />Not verified — prototype account</span>
        </div>
      </section>
      <p className="list-title">Account</p>
      <div className="list">
        <SettingRow icon={<MapPin size={18} />} title="Address" detail={e.address} />
        <SettingRow icon={<Navigation size={18} />} title="Map location" detail={e.latitude != null && e.longitude != null ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : 'Not set'} />
        <SettingRow icon={<ClipboardList size={18} />} title="Jobs posted from this phone" detail={String(session.jobIds.length)} onClick={go.jobs} />
        <SettingRow icon={<RefreshCw size={18} />} title="Switch to worker mode" detail={session.workerId ? 'Open your worker dashboard' : 'Create a worker profile'} onClick={onWorkerMode} />
      </div>
      <button className="btn btn-ghost danger mt-16" type="button" onClick={onSignOut}><LogOut size={17} />Sign out of this phone</button>
      <p className="small center">Employer ID {e.employerId}</p>
      {employerNav('profile', go)}
    </main>
  );
}
