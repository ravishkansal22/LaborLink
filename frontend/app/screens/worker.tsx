'use client';

import { t, tx } from '../lib/i18n';
import { useState } from 'react';
import {
  ArrowRight, BadgeCheck, BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleCheck, Clock, House, Info, LogOut, MapPin,
  Navigation, RefreshCw, Send, UserRound, Wrench,
} from 'lucide-react';
import {
  AppBar, Avatar, BottomNav, Chip, Empty, ErrorNote, JobSteps, LanguageSetting, Loading, Note, Photo, PhotoPicker, SettingRow, StatusChip,
  Toggle, stepLabels, stepsFor, type PickedPhoto, type Tone,
} from '../components/ui';
import {
  allTrades, api, capitalise, hours, money, tradeNames, when, type EarningStatus, type Opportunity, type Trade, type WorkerOffer,
} from '../lib/api';
import { useLoad, type Language } from '../lib/session';

export type WorkerGo = { home: () => void; jobs: () => void; passbook: () => void; profile: () => void };
function workerNav(active: 'home' | 'jobs' | 'passbook' | 'profile', go: WorkerGo) {
  return (
    <BottomNav items={[
      { label: 'Home', icon: <House size={22} />, active: active === 'home', onClick: go.home },
      { label: 'Find work', icon: <BriefcaseBusiness size={22} />, active: active === 'jobs', onClick: go.jobs },
      { label: 'Passbook', icon: <BookOpen size={22} />, active: active === 'passbook', onClick: go.passbook },
      { label: 'Profile', icon: <UserRound size={22} />, active: active === 'profile', onClick: go.profile },
    ]} />
  );
}

function OnlineSwitch({ workerId, available, onChanged }: { workerId: string; available: boolean; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => {
    setSaving(true);
    try { await api.updateWorker(workerId, { availability: available ? 'unavailable' : 'available' }); onChanged(); } finally { setSaving(false); }
  };
  return (
    <>
      <span className={`online ${available ? 'on' : ''}`}>{available ? t('Online') : t('Offline')}</span>
      <Toggle on={available} disabled={saving} onChange={() => void toggle()} label={t('Available for work')} />
    </>
  );
}

const offerChip: Record<WorkerOffer['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Waiting', tone: 'orange' },
  accepted: { label: 'You got the job', tone: 'green' },
  rejected: { label: 'Not chosen', tone: 'plain' },
};

function OpportunityRow({ item, onOpen }: { item: Opportunity; onOpen: () => void }) {
  return (
    <button type="button" className="card lead-row" onClick={onOpen}>
      <span className="grow">
        <span className="row gap-6">
          {item.urgency === 'urgent' ? <Chip tone="red" icon={<Clock size={12} />}>{t('Urgent')}</Chip> : <Chip>{t(capitalise(item.urgency))}</Chip>}
          {item.has_active_offer && <Chip tone="green" icon={<Check size={12} />}>{t('Offer sent')}</Chip>}
        </span>
        <strong className="h4 block mt-6">{tx(item.problem_summary)}</strong>
        <small className="small block">
          {t(tradeNames[item.trade].en)} · {item.distance_km != null ? t('{km} km away', { km: item.distance_km }) : t('distance unknown')} · {t('about {time}', { time: hours(item.estimated_duration) })}
        </small>
      </span>
      <span className="right">
        <strong className="amount">{money(item.offer_terms.suggested_labour_amount)}</strong>
        <small className="small">{t('suggested')}</small>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ home */

export function WorkerHomeScreen({ workerId, go, onOpenJob, onOpportunity }: { workerId: string; go: WorkerGo; onOpenJob: (id: string) => void; onOpportunity: (o: Opportunity) => void }) {
  const data = useLoad(async () => {
    const [worker, passbook, offers, opportunities] = await Promise.all([
      api.getWorker(workerId), api.passbook(workerId), api.workerOffers(workerId), api.opportunities(workerId),
    ]);
    return { worker, passbook, offers: offers.offers, opportunities };
  }, [workerId], 10000);

  if (!data.data) {
    return <main className="screen has-nav">{data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading />}{workerNav('home', go)}</main>;
  }
  const { worker, passbook, offers, opportunities } = data.data;
  const s = passbook.summary;
  const current = passbook.entries.filter((e) => e.earning_status === 'in_progress');
  const fresh = opportunities.items.filter((o) => !o.has_active_offer).slice(0, 2);

  return (
    <main className="screen has-nav">
      <header className="home-head">
        <Avatar name={worker.display_name} size={40} />
        <div className="grow"><p className="small">{t('Namaste')}</p><h1 className="h3">{worker.display_name}</h1></div>
        <OnlineSwitch workerId={workerId} available={worker.availability === 'available'} onChanged={() => void data.reload(true)} />
      </header>

      <section className="earn-card mt-16">
        <p>{t('Confirmed earnings')}</p>
        <strong>{money(s.confirmed_earnings, passbook.currency)}</strong>
        <div className="earn-split">
          <span><small>{t('Paid (demo)')}</small>{money(s.simulated_settled_earnings, passbook.currency)}</span>
          <span><small>{t('Payment pending')} · {s.pending_settlements.count}</small>{money(s.pending_settlements.amount, passbook.currency)}</span>
        </div>
        <button type="button" onClick={go.passbook}>{t('Open Kamai Passbook')} <ChevronRight size={16} /></button>
      </section>

      <div className="stat-tiles mt-12">
        <div><strong>{s.completed_jobs}</strong><small>{t('Jobs completed')}</small></div>
        <div><strong>{s.active_jobs}</strong><small>{t('Active now')}</small></div>
        <div><strong>{worker.service_radius_km} {t('km')}</strong><small>{t('Work radius')}</small></div>
      </div>

      <div className="section-head"><h2 className="h3">{t('Your jobs')}</h2></div>
      {current.length === 0 ? (
        <Empty icon={<Wrench size={20} />} title={t('No booked jobs right now')} text={t('When a customer books you, the job shows up here.')} />
      ) : (
        <div className="stack">
          {current.map((entry) => (
            <button key={entry.job_id} type="button" className="card job-card" onClick={() => onOpenJob(entry.job_id)}>
              <div className="row spread"><StatusChip status={entry.job_status} /><strong className="amount">{money(entry.agreed_total_amount, entry.currency)}</strong></div>
              <h3 className="h4 mt-10">{tx(entry.problem_summary)}</h3>
              <p className="small">{t('Booked {when}', { when: when(entry.booked_at) })}</p>
              <JobSteps labels={stepLabels} {...stepsFor(entry.job_status)} />
            </button>
          ))}
        </div>
      )}

      <div className="section-head"><h2 className="h3">{t('My offers')}</h2><span className="small">{t('{n} total', { n: offers.length })}</span></div>
      {offers.length === 0 ? (
        <Empty icon={<Send size={20} />} title={t('No offers sent yet')} text={t('Find a job nearby and send your price.')} />
      ) : (
        <div className="list">
          {offers.slice(0, 4).map((offer) => (
            <div key={offer.id} className="list-row">
              <span className="tile-icon small-tile"><Send size={16} /></span>
              <div className="grow"><strong className="h4">{tx(offer.problem_summary)}</strong><small className="small block">{t('You offered {labour} + {travel} travel', { labour: money(offer.labour_amount, offer.currency), travel: money(offer.travel_allowance, offer.currency) })} · {when(offer.created_at)}</small></div>
              <Chip tone={offerChip[offer.status].tone}>{t(offerChip[offer.status].label)}</Chip>
            </div>
          ))}
        </div>
      )}

      <div className="section-head"><h2 className="h3">{t('New jobs near you')}</h2><button className="link-btn" type="button" onClick={go.jobs}>{t('See all')} <ChevronRight size={15} /></button></div>
      {fresh.length === 0 ? (
        <Empty icon={<BriefcaseBusiness size={20} />} title={t('No new jobs right now')} text={opportunities.limitations[0] ? t(opportunities.limitations[0]) : t('New jobs that match your trade and area will appear here.')} />
      ) : (
        <div className="stack">{fresh.map((o) => <OpportunityRow key={o.job_id} item={o} onOpen={() => onOpportunity(o)} />)}</div>
      )}

      {workerNav('home', go)}
    </main>
  );
}

/* ------------------------------------------------------------------ find work */

export function FindWorkScreen({ workerId, go, onOpportunity }: { workerId: string; go: WorkerGo; onOpportunity: (o: Opportunity) => void }) {
  const data = useLoad(async () => {
    const [worker, opportunities] = await Promise.all([api.getWorker(workerId), api.opportunities(workerId)]);
    return { worker, opportunities };
  }, [workerId], 10000);
  const [saving, setSaving] = useState(false);
  const setRadius = async (km: number) => {
    setSaving(true);
    try { await api.updateWorker(workerId, { service_radius_km: km }); await data.reload(true); } finally { setSaving(false); }
  };

  return (
    <main className="screen has-nav">
      {!data.data ? (data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading />) : (
        <>
          <header className="home-head">
            <div className="grow">
              <h1 className="h2">{t('Jobs near you')}</h1>
              <p className="small with-icon"><MapPin size={13} />{data.data.worker.location.locality ?? t('Your area')} · {data.data.worker.trades.map((tr) => t(tradeNames[tr].en)).join(', ')}</p>
            </div>
            <OnlineSwitch workerId={workerId} available={data.data.worker.availability === 'available'} onChanged={() => void data.reload(true)} />
          </header>
          <div className="row gap-6 mt-12">
            <span className="small">{t('Within')}</span>
            {[2, 5, 10, 15, 25].map((km) => (
              <button key={km} type="button" disabled={saving} className={`seg-btn ${data.data!.worker.service_radius_km === km ? 'on' : ''}`} onClick={() => void setRadius(km)}>{km} {t('km')}</button>
            ))}
          </div>
          <div className="section-head"><h2 className="h3">{data.data.opportunities.items.length === 1 ? t('1 open job') : t('{n} open jobs', { n: data.data.opportunities.items.length })}</h2><span className="small with-icon"><RefreshCw size={12} />{t('Live')}</span></div>
          {data.data.opportunities.items.length === 0 ? (
            <Empty icon={<BriefcaseBusiness size={20} />} title={t('No open jobs match you right now')}
              text={data.data.opportunities.limitations[0] ? t(data.data.opportunities.limitations[0]) : t('Try a bigger radius, or check back soon.')} />
          ) : (
            <div className="stack">{data.data.opportunities.items.map((o) => <OpportunityRow key={o.job_id} item={o} onOpen={() => onOpportunity(o)} />)}</div>
          )}
          <div className="mt-16"><Note><strong>{t('FairRate')}</strong> {t('Offers must stay inside each job’s range, so nobody can undercut your rate.')}</Note></div>
        </>
      )}
      {workerNav('jobs', go)}
    </main>
  );
}

/* ------------------------------------------------------------------ one opportunity, offers */

export function OpportunityScreen({ workerId, opportunity, onBack, onCounter, onSent }: { workerId: string; opportunity: Opportunity; onBack: () => void; onCounter: () => void; onSent: () => void }) {
  const o = opportunity;
  const terms = o.offer_terms;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const accept = async () => {
    setSaving(true);
    setError(null);
    try { await api.createOffer(o.job_id, { worker_id: workerId, kind: 'accept_suggested' }); onSent(); } catch (err) { setError(err); setSaving(false); }
  };
  return (
    <main className="screen">
      <AppBar title={t('Job details')} subtitle={t('Posted {when}', { when: when(o.created_at) })} onBack={onBack} />
      <div className="row gap-6">
        {o.urgency === 'urgent' ? <Chip tone="red" icon={<Clock size={12} />}>{t('Urgent')}</Chip> : <Chip>{t(capitalise(o.urgency))}</Chip>}
        <Chip tone="green">{t(tradeNames[o.trade].en)}</Chip>
      </div>
      <h1 className="h1 mt-12">{tx(o.problem_summary)}</h1>
      <p className="small with-icon mt-6"><Navigation size={13} />{o.distance_km != null ? t('{km} km from you', { km: o.distance_km }) : t('Distance unknown')}</p>

      <section className="card mt-16">
        <div className="lines">
          <p><span>{t('Type of work')}</span><strong>{t(capitalise(o.problem_category.replace(/_/g, ' ')))}</strong></p>
          <p><span>{t('Difficulty')}</span><strong>{t(capitalise(o.complexity))}</strong></p>
          <p><span>{t('Expected time')}</span><strong>{t('about {time}', { time: hours(o.estimated_duration) })}</strong></p>
        </div>
      </section>

      <section className="card price-card mt-12">
        <p className="small">{t('Suggested price for labour')}</p>
        <strong className="big-amount">{money(terms.suggested_labour_amount, terms.currency)}</strong>
        <p className="small mt-2">{t('You can offer {range} · plus {travel} travel', { range: `${money(terms.permitted_min)}–${money(terms.permitted_max)}`, travel: money(terms.travel_allowance) })}</p>
        <p className="small mt-6">{t(terms.basis)}</p>
      </section>

      {o.limitations.map((l) => <div key={l} className="mt-12"><Note>{t(l)}</Note></div>)}
      {o.has_active_offer && <div className="mt-12"><Note>{t('You’ve already sent an offer for this job. The customer will see it with the others.')}</Note></div>}
      {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}

      <div className="grid-2 mt-20 sticky-actions">
        <button className="btn btn-secondary" type="button" disabled={o.has_active_offer || saving} onClick={onCounter}>{t('Counter offer')}</button>
        <button className="btn btn-primary" type="button" disabled={o.has_active_offer || saving} onClick={() => void accept()}>
          {saving ? t('Sending…') : t('Accept {amount}', { amount: money(terms.suggested_labour_amount) })}
        </button>
      </div>
    </main>
  );
}

export function CounterOfferScreen({ workerId, opportunity, onBack, onSent }: { workerId: string; opportunity: Opportunity; onBack: () => void; onSent: () => void }) {
  const terms = opportunity.offer_terms;
  const [amount, setAmount] = useState(terms.suggested_labour_amount);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const quick = ['I can come today', 'I have my own tools', 'Parts will be billed separately'];
  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.createOffer(opportunity.job_id, { worker_id: workerId, kind: 'counter', labour_amount: amount, message: message.trim() || undefined });
      onSent();
    } catch (err) { setError(err); setSaving(false); }
  };
  return (
    <main className="screen">
      <AppBar title={t('Your offer')} subtitle={tx(opportunity.problem_summary)} onBack={onBack} />
      <section className="card center">
        <p className="small">{t('Your price for labour')}</p>
        <strong className="huge-amount">{money(amount, terms.currency)}</strong>
        <p className="small">{t('Suggested {amount}', { amount: money(terms.suggested_labour_amount) })}</p>
        <input className="slider mt-16" type="range" min={terms.permitted_min} max={terms.permitted_max} step={10} value={amount}
          onChange={(e) => setAmount(Number(e.target.value))} aria-label={t('Offer amount')} />
        <div className="row spread small"><span>{money(terms.permitted_min)}</span><span>{money(terms.permitted_max)}</span></div>
      </section>
      <div className="mt-12"><Note>{t(terms.basis)}</Note></div>
      <section className="card mt-12">
        <div className="lines">
          <p><span>{t('Labour')}</span><strong>{money(amount)}</strong></p>
          <p><span>{t('Travel')}</span><strong>{money(terms.travel_allowance)}</strong></p>
          <p className="total"><span>{t('Customer pays')}</span><strong>{money(amount + terms.travel_allowance)}</strong></p>
        </div>
      </section>
      <label className="field-label mt-16" htmlFor="message">{t('Message to the customer')} <span className="tiny-tag">{t('optional')}</span></label>
      <div className="tag-row">
        {quick.map((q) => t(q)).map((q) => <button key={q} type="button" className="tag" onClick={() => setMessage((m) => (m ? `${m} ${q}.` : `${q}.`).slice(0, 280))}>{q}</button>)}
      </div>
      <textarea id="message" className="text-area mt-6" rows={2} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} />
      {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}
      <div className="push-bottom">
        <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void send()}><Send size={17} />{saving ? t('Sending…') : t('Send offer · {amount}', { amount: money(amount) })}</button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ a booked job */

export function WorkerJobScreen({ workerId, jobId, onBack, onPassbook, onTrip }: {
  workerId: string; jobId: string; onBack: () => void; onPassbook: () => void; onTrip: () => void;
}) {
  const data = useLoad(async () => {
    const [job, booking] = await Promise.all([api.getJob(jobId), api.booking(jobId)]);
    return { job, booking };
  }, [jobId], 5000);
  const [before, setBefore] = useState<PickedPhoto[]>([]);
  const [after, setAfter] = useState<PickedPhoto[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!data.data) {
    return <main className="screen"><AppBar title={t('Your job')} onBack={onBack} />{data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading />}</main>;
  }
  const { job, booking } = data.data;
  const mine = booking.worker.id === workerId;
  const act = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try { await fn(); await data.reload(true); } catch (err) { setError(err); } finally { setSaving(false); }
  };

  return (
    <main className="screen">
      <AppBar title={t('Your job')} subtitle={`#${job.id.slice(0, 8)}`} onBack={onBack} />
      <StatusChip status={job.status} />
      <h1 className="h1 mt-10">{tx(job.work_order.problem_summary)}</h1>
      <JobSteps labels={stepLabels} {...stepsFor(job.status)} />

      <section className="card mt-16">
        <p className="small with-icon"><MapPin size={13} />{job.request.location.address ?? t('Address shared on the map')}</p>
        <blockquote className="quote mt-10">“{tx(job.request.description)}”</blockquote>
        {job.request.image_id && <div className="grid-2 mt-10"><Photo src={api.imageUrl(job.request.image_id)} label={t('Customer’s photo')} /></div>}
        {(job.work_order.likely_tools.length > 0) && (
          <><p className="field-label mt-12">{t('Bring')}</p><div className="tag-row">{[...job.work_order.likely_tools, ...job.work_order.likely_materials].map((tr) => <span key={tr} className="tag">{t(tr)}</span>)}</div></>
        )}
      </section>

      <section className="card mt-12">
        <h2 className="h4">{t('Agreed payment')}</h2>
        <div className="lines mt-6">
          <p><span>{t('Labour')}</span><strong>{money(booking.agreed_labour_amount, booking.currency)}</strong></p>
          <p><span>{t('Travel')}</span><strong>{money(booking.travel_allowance, booking.currency)}</strong></p>
          <p className="total"><span>{t('You’ll get')}</span><strong>{money(booking.agreed_total_amount, booking.currency)}</strong></p>
        </div>
      </section>

      {!mine && <div className="mt-12"><Note>{t('This job is booked with another worker.')}</Note></div>}
      {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}

      {mine && job.status === 'booked' && (
        <div className="push-bottom">
          <Note>{t('Start the trip so the customer can see you coming on the map.')}</Note>
          <button className="btn btn-primary mt-12" type="button" onClick={onTrip}><Navigation size={18} />{t('Start trip to customer')}</button>
          <button className="btn btn-secondary mt-10" type="button" disabled={saving} onClick={() => void act(() => api.startJob(jobId, workerId))}>
            {saving ? t('Starting…') : <>{t('Already there? Start the job')} <ArrowRight size={18} /></>}
          </button>
        </div>
      )}

      {mine && job.status === 'in_progress' && (
        <>
          <section className="mt-20">
            <h2 className="h3">{t('Photos of your work')}</h2>
            <p className="small mt-2">{t('The customer checks these before confirming the job.')}</p>
            <p className="field-label mt-12">{t('Before')} <span className="tiny-tag">{t('optional')}</span></p>
            <PhotoPicker photos={before} onChange={setBefore} max={5} label={t('Before')} />
            <p className="field-label mt-12">{t('After')} <span className="tiny-tag">{t('at least 1')}</span></p>
            <PhotoPicker photos={after} onChange={setAfter} max={5} label={t('After')} />
            <label className="field-label mt-12" htmlFor="note">{t('Note for the customer')}</label>
            <textarea id="note" className="text-area" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('What did you fix or replace?')} />
          </section>
          <div className="push-bottom">
            <button className="btn btn-primary" type="button" disabled={saving || after.length === 0}
              onClick={() => void act(() => api.submitEvidence(jobId, { worker_id: workerId, before_image_ids: before.map((p) => p.id), after_image_ids: after.map((p) => p.id), note: note.trim() || null }))}>
              <Send size={17} />{saving ? t('Sending…') : t('Send for confirmation')}
            </button>
            {after.length === 0 && <p className="small center mt-6">{t('Add at least one “after” photo to continue.')}</p>}
          </div>
        </>
      )}

      {mine && job.status === 'awaiting_confirmation' && (
        <section className="success-card mt-16">
          <Clock size={30} />
          <h2 className="h3">{t('Waiting for the customer')}</h2>
          <p>{t('They’re checking your photos. Once they confirm, {amount} goes into your Kamai Passbook.', { amount: money(booking.agreed_total_amount) })}</p>
        </section>
      )}

      {mine && job.status === 'completed' && <WorkerPayment jobId={jobId} onPassbook={onPassbook} />}
      {mine && job.status === 'disputed' && (
        <div className="mt-16"><Note>{t('The customer reported a problem with this job, so the payment is on hold.')}</Note></div>
      )}
    </main>
  );
}

function WorkerPayment({ jobId, onPassbook }: { jobId: string; onPassbook: () => void }) {
  const settlement = useLoad(() => api.settlement(jobId), [jobId], 8000);
  if (settlement.error) return <div className="mt-12"><ErrorNote error={settlement.error} onRetry={() => void settlement.reload()} /></div>;
  if (!settlement.data) return <Loading />;
  const paid = settlement.data.status === 'simulated_settled';
  return (
    <>
      <section className="success-card mt-16">
        <CircleCheck size={32} />
        <h2 className="h3">{paid ? t('Paid (demo)') : t('Job confirmed')}</h2>
        <p>{paid ? t('{amount} was recorded {when}.', { amount: money(settlement.data.amount), when: settlement.data.settled_at ? when(settlement.data.settled_at) : '' }) : t('The customer confirmed your work. {amount} is waiting to be paid.', { amount: money(settlement.data.amount) })}</p>
      </section>
      <div className="push-bottom"><button className="btn btn-primary" type="button" onClick={onPassbook}><BookOpen size={17} />{t('Open Kamai Passbook')}</button></div>
    </>
  );
}

/* ------------------------------------------------------------------ passbook */

const earningChip: Record<EarningStatus, { label: string; tone: Tone }> = {
  in_progress: { label: 'In progress', tone: 'orange' },
  confirmed_unsettled: { label: 'Payment pending', tone: 'plain' },
  settled: { label: 'Paid (demo)', tone: 'green' },
  disputed: { label: 'Disputed · not paid', tone: 'red' },
};

export function PassbookScreen({ workerId, go, onOpenJob }: { workerId: string; go: WorkerGo; onOpenJob: (id: string) => void }) {
  const data = useLoad(() => api.passbook(workerId), [workerId], 10000);
  const [filter, setFilter] = useState<'all' | EarningStatus>('all');
  const filters: Array<{ id: 'all' | EarningStatus; label: string }> = [
    { id: 'all', label: 'All' }, { id: 'settled', label: 'Paid' }, { id: 'confirmed_unsettled', label: 'Pending' },
    { id: 'in_progress', label: 'Ongoing' }, { id: 'disputed', label: 'Disputed' },
  ];
  return (
    <main className="screen has-nav">
      <header className="home-head"><div className="grow"><h1 className="h2">{t('Kamai Passbook')}</h1><p className="small">{t('Your work and earnings record')}</p></div></header>
      {!data.data ? (data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading />) : (() => {
        const p = data.data;
        const s = p.summary;
        const shown = filter === 'all' ? p.entries : p.entries.filter((e) => e.earning_status === filter);
        return (
          <>
            <section className="earn-card mt-16">
              <p>{t('Confirmed earnings')}</p>
              <strong>{money(s.confirmed_earnings, p.currency)}</strong>
              <div className="earn-split">
                <span><small>{t('Paid (demo)')}</small>{money(s.simulated_settled_earnings, p.currency)}</span>
                <span><small>{t('Pending')} · {s.pending_settlements.count}</small>{money(s.pending_settlements.amount, p.currency)}</span>
              </div>
            </section>
            <div className="stat-tiles mt-12">
              <div><strong>{s.completed_jobs}</strong><small>{t('Jobs completed')}</small></div>
              <div><strong>{s.active_jobs}</strong><small>{t('In progress')}</small></div>
              <div><strong className={s.disputed.count ? 'danger' : ''}>{s.disputed.count}</strong><small>{t('Disputed ({amount})', { amount: money(s.disputed.amount, p.currency) })}</small></div>
            </div>
            <div className="row gap-6 mt-16 scroll-x">
              {filters.map((f) => <button key={f.id} type="button" className={`seg-btn ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>{t(f.label)}</button>)}
            </div>
            {shown.length === 0 ? (
              <div className="mt-12"><Empty icon={<BookOpen size={20} />} title={t('Nothing here yet')} text={t('Jobs you’re booked for, and what you earn from them, are recorded here.')} /></div>
            ) : (
              <div className="list mt-12">
                {shown.map((entry) => (
                  <button key={entry.job_id} type="button" className="list-row align-start" onClick={() => onOpenJob(entry.job_id)}>
                    <div className="grow">
                      <strong className="h4">{tx(entry.problem_summary)}</strong>
                      <small className="small block">{entry.trade ? t(tradeNames[entry.trade].en) : t('Job')} · {when(entry.completed_at ?? entry.disputed_at ?? entry.booked_at)}</small>
                      <div className="mt-6"><Chip tone={earningChip[entry.earning_status].tone}>{t(earningChip[entry.earning_status].label)}</Chip></div>
                      {entry.dispute_reason && <small className="small block mt-6">“{tx(entry.dispute_reason)}”</small>}
                    </div>
                    <strong className={`amount ${entry.earning_status === 'disputed' ? 'struck' : ''}`}>{money(entry.agreed_total_amount, entry.currency)}</strong>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-12"><Note>{t(p.disclaimer)}</Note></div>
          </>
        );
      })()}
      {workerNav('passbook', go)}
    </main>
  );
}

/* ------------------------------------------------------------------ profile */

export function WorkerProfileScreen({ workerId, go, onHireMode, onSignOut, hasEmployer, language, onLanguage }: {
  workerId: string; go: WorkerGo; onHireMode: () => void; onSignOut: () => void; hasEmployer: boolean;
  language: Language; onLanguage: (language: Language) => void;
}) {
  const data = useLoad(async () => {
    const [worker, passbook] = await Promise.all([api.getWorker(workerId), api.passbook(workerId)]);
    return { worker, passbook };
  }, [workerId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const patch = async (body: Parameters<typeof api.updateWorker>[1]) => {
    setSaving(true);
    setError(null);
    try { await api.updateWorker(workerId, body); await data.reload(true); } catch (err) { setError(err); } finally { setSaving(false); }
  };

  return (
    <main className="screen has-nav">
      <AppBar title={t('Profile')} right={<span className="appbar-spacer" />} />
      {!data.data ? (data.error ? <ErrorNote error={data.error} onRetry={() => void data.reload()} /> : <Loading />) : (() => {
        const w = data.data.worker;
        const toggleTrade = (trade: Trade) => {
          const next = w.trades.includes(trade) ? w.trades.filter((x) => x !== trade) : [...w.trades, trade];
          if (next.length) void patch({ trades: next });
        };
        return (
          <>
            <section className="profile-head">
              <Avatar name={w.display_name} size={64} />
              <div>
                <h2 className="h2">{w.display_name}</h2>
                <p className="small">{w.trades.map((tr) => t(tradeNames[tr].en)).join(', ')}{w.years_experience != null ? ` · ${t('{n} years', { n: w.years_experience })}` : ''}</p>
                <span className="row gap-4 small mt-2"><BadgeCheck size={14} className="muted" />{t('Not verified — details are self-declared')}</span>
              </div>
            </section>
            <div className="stat-tiles mt-16">
              <div><strong>{data.data.passbook.summary.completed_jobs}</strong><small>{t('Jobs completed')}</small></div>
              <div><strong>{w.service_radius_km} {t('km')}</strong><small>{t('Work radius')}</small></div>
              <div><strong>{when(w.created_at).split(',')[0]}</strong><small>{t('Joined')}</small></div>
            </div>
            <section className="card mt-12">
              <div className="row">
                <div className="grow"><strong className="h4">{t('Available for work')}</strong><p className="small">{t('Customers nearby can see you and send jobs')}</p></div>
                <OnlineSwitch workerId={workerId} available={w.availability === 'available'} onChanged={() => void data.reload(true)} />
              </div>
            </section>
            <section className="card mt-12">
              <h3 className="h4">{t('Trades')}</h3>
              <div className="tag-row mt-10">
                {allTrades.map((tr) => (
                  <button key={tr} type="button" disabled={saving} className={`tag ${w.trades.includes(tr) ? 'on' : ''}`} onClick={() => toggleTrade(tr)}>
                    {w.trades.includes(tr) && <Check size={14} />}{t(tradeNames[tr].en)}
                  </button>
                ))}
              </div>
              <p className="field-label mt-12">{t('Work within')}</p>
              <div className="row gap-6">
                {[2, 5, 10, 15, 25].map((km) => (
                  <button key={km} type="button" disabled={saving} className={`seg-btn ${w.service_radius_km === km ? 'on' : ''}`} onClick={() => void patch({ service_radius_km: km })}>{km} {t('km')}</button>
                ))}
              </div>
            </section>
            {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}
            <LanguageSetting language={language} onChange={onLanguage} />
            <p className="list-title">{t('Account')}</p>
            <div className="list">
              <SettingRow icon={<MapPin size={18} />} title={t('Base location')} detail={w.location.locality ?? `${w.location.latitude.toFixed(4)}, ${w.location.longitude.toFixed(4)}`} />
              <SettingRow icon={<RefreshCw size={18} />} title={t('Switch to hiring mode')} detail={hasEmployer ? t('Open your employer dashboard') : t('Set up an employer profile')} onClick={onHireMode} />
            </div>
            <button className="btn btn-ghost danger mt-16" type="button" onClick={onSignOut}><LogOut size={17} />{t('Sign out of this phone')}</button>
            <p className="small center with-icon centered"><Info size={12} />{t('Worker ID')} {w.id.slice(0, 8)}</p>
          </>
        );
      })()}
      {workerNav('profile', go)}
    </main>
  );
}
