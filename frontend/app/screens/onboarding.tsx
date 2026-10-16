'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, BriefcaseBusiness, Camera, Hammer, Languages, Mic, Navigation, ShieldCheck, Zap } from 'lucide-react';
import { AppBar, ErrorNote, Steps, Toggle } from '../components/ui';
import { allTrades, api, tradeNames, type Trade } from '../lib/api';
import { areas } from '../lib/places';
import type { Language, Role, Session } from '../lib/session';

const languages: Array<{ id: Language; badge: string; title: string; subtitle: string }> = [
  { id: 'en', badge: 'En', title: 'English', subtitle: 'For households and contractors' },
  { id: 'hi', badge: 'हिं', title: 'हिंदी', subtitle: 'कारीगर और ठेकेदार के लिए' },
];

export function WelcomeScreen({ language, setLanguage, onContinue }: { language: Language; setLanguage: (l: Language) => void; onContinue: () => void }) {
  return (
    <main className="screen welcome">
      <div className="welcome-brand">
        <span className="logo"><Hammer size={30} /></span>
        <h1 className="wordmark">LaborLink</h1>
        <p>Skilled workers nearby, at a fair price.</p>
        <p className="hindi">पास के कारीगर, सही दाम पर।</p>
      </div>
      <ul className="welcome-points">
        <li><Zap size={18} /><span>Electricians, plumbers, masons and carpenters near you</span></li>
        <li><ShieldCheck size={18} /><span>See a fair price range before you book</span></li>
        <li><BookOpen size={18} /><span>Workers keep a record of every job and payment</span></li>
      </ul>
      <section className="card language-card" aria-labelledby="language-heading">
        <div className="row spread"><h2 id="language-heading" className="h3">Choose language</h2><span className="small">भाषा चुनें</span></div>
        <div className="stack-sm">
          {languages.map((item) => {
            const active = language === item.id;
            return (
              <button className={`option ${active ? 'selected' : ''}`} key={item.id} type="button" onClick={() => setLanguage(item.id)} aria-pressed={active}>
                <span className="option-badge">{item.badge}</span>
                <span className="option-text"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                <span className="radio" />
              </button>
            );
          })}
        </div>
        <p className="small with-icon"><Languages size={15} />Voice notes will be understood in this language.</p>
      </section>
      <div className="push-bottom">
        <button className="btn btn-primary" type="button" onClick={onContinue}>Continue · आगे बढ़ें <ArrowRight size={18} /></button>
      </div>
    </main>
  );
}

export function AccountScreen({ role, setRole, onBack, onContinue }: { role: Role; setRole: (r: Role) => void; onBack: () => void; onContinue: () => void }) {
  return (
    <main className="screen">
      <AppBar onBack={onBack} right={<span className="step-count">1 of 3</span>} />
      <Steps current={1} total={3} />
      <h1 className="h1 mt-20">How will you use LaborLink?</h1>
      <p className="body mt-6">You can switch between hiring and working from your profile.</p>
      <div className="stack mt-20">
        <RoleCard active={role === 'employer'} onClick={() => setRole('employer')} icon={<BriefcaseBusiness size={22} />}
          title="I need work done" hindi="मुझे काम करवाना है"
          description="Describe the job with a photo or voice note. Get a price range and offers from workers nearby." />
        <RoleCard active={role === 'worker'} onClick={() => setRole('worker')} icon={<Hammer size={22} />}
          title="I want work" hindi="मुझे काम चाहिए"
          description="See jobs near you for your trade, send your price, and keep a record of what you earn." />
      </div>
      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">Continue as {role === 'employer' ? 'employer' : 'worker'} <ArrowRight size={18} /></button>
      </div>
    </main>
  );
}

function RoleCard({ active, icon, title, hindi, description, onClick }: { active: boolean; icon: ReactNode; title: string; hindi: string; description: string; onClick: () => void }) {
  return (
    <button className={`role-card ${active ? 'selected' : ''}`} onClick={onClick} type="button" aria-pressed={active}>
      <span className="role-icon">{icon}</span>
      <span className="role-text"><strong>{title}</strong><em>{hindi}</em><small>{description}</small></span>
      <span className="radio" />
    </button>
  );
}

type Permission = 'idle' | 'asking' | 'granted' | 'denied' | 'unsupported';
const permissionText: Record<Permission, string> = {
  idle: 'Not allowed yet', asking: 'Asking…', granted: 'Allowed', denied: 'Blocked — you can continue without it', unsupported: 'Not available on this device',
};

export function PermissionsScreen({ onBack, onContinue, onCoords }: { onBack: () => void; onContinue: () => void; onCoords: (c: { latitude: number; longitude: number }) => void }) {
  const [location, setLocation] = useState<Permission>('idle');
  const [mic, setMic] = useState<Permission>('idle');
  const [camera, setCamera] = useState<Permission>('idle');

  const askLocation = () => {
    if (!navigator.geolocation) { setLocation('unsupported'); return; }
    setLocation('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => { onCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocation('granted'); },
      () => setLocation('denied'),
      { timeout: 12000, maximumAge: 60000 },
    );
  };
  const askMedia = (kind: 'audio' | 'video', set: (p: Permission) => void) => {
    if (!navigator.mediaDevices?.getUserMedia) { set('unsupported'); return; }
    set('asking');
    navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: true } : { video: true })
      .then((stream) => { stream.getTracks().forEach((t) => t.stop()); set('granted'); })
      .catch(() => set('denied'));
  };

  return (
    <main className="screen">
      <AppBar onBack={onBack} right={<span className="step-count">2 of 3</span>} />
      <Steps current={2} total={3} />
      <h1 className="h1 mt-20">A few permissions</h1>
      <p className="body mt-6">Only used while you’re posting or doing a job.</p>
      <div className="list mt-20">
        <PermissionRow icon={<Navigation size={20} />} title="Location" state={location} onAsk={askLocation}
          description="To find workers or jobs near you and show how far away they are." />
        <PermissionRow icon={<Mic size={20} />} title="Microphone" state={mic} onAsk={() => askMedia('audio', setMic)}
          description="To describe a job by voice, in Hindi or English." />
        <PermissionRow icon={<Camera size={20} />} title="Camera" state={camera} onAsk={() => askMedia('video', setCamera)}
          description="To send photos of the problem and of the finished work." />
      </div>
      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">Continue <ArrowRight size={18} /></button>
      </div>
    </main>
  );
}

function PermissionRow({ icon, title, description, state, onAsk }: { icon: ReactNode; title: string; description: string; state: Permission; onAsk: () => void }) {
  return (
    <div className="list-row align-start">
      <span className="tile-icon">{icon}</span>
      <div className="grow">
        <strong className="h4">{title}</strong>
        <p className="small mt-2">{description}</p>
        <p className={`tiny-tag mt-2 ${state === 'granted' ? 'green-text' : state === 'denied' ? 'danger' : ''}`}>{permissionText[state]}</p>
      </div>
      <Toggle on={state === 'granted'} onChange={onAsk} label={`Allow ${title}`} disabled={state === 'granted' || state === 'asking'} />
    </div>
  );
}

const CURRENT = '__current__';

export function ProfileSetupScreen({ role, session, onBack, onEmployerReady, onWorkerReady }: {
  role: Role; session: Session; onBack: () => void;
  onEmployerReady: (profile: { name: string; phone: string; address: string; latitude: number; longitude: number }) => void;
  onWorkerReady: (workerId: string) => void;
}) {
  // Employer and worker are different people, so only an employer's own details are prefilled.
  const own = role === 'employer' ? session.employer : null;
  const [name, setName] = useState(own?.name ?? '');
  const [phone, setPhone] = useState(own?.phone ?? '');
  const [area, setArea] = useState(session.coords ? CURRENT : '');
  const [street, setStreet] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [years, setYears] = useState('');
  const [radius, setRadius] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const place = area === CURRENT && session.coords
    ? { name: 'Current location', ...session.coords }
    : areas.find((a) => a.name === area);
  const missing = [
    name.trim().length < 2 && 'your name',
    !/^\d{10}$/.test(phone) && 'a 10-digit mobile number',
    !place && 'your area',
    role === 'worker' && trades.length === 0 && 'at least one trade',
  ].filter(Boolean) as string[];

  const submit = async () => {
    if (!place || missing.length) return;
    setSaving(true);
    setError(null);
    try {
      if (role === 'employer') {
        const address = [street.trim(), place.name === 'Current location' ? '' : place.name].filter(Boolean).join(', ') || 'Current location';
        onEmployerReady({ name: name.trim(), phone, address, latitude: place.latitude, longitude: place.longitude });
      } else {
        const worker = await api.createWorker({
          display_name: name.trim(),
          trades,
          years_experience: years === '' ? null : Number(years),
          location: { latitude: place.latitude, longitude: place.longitude, locality: place.name === 'Current location' ? (street.trim() || null) : place.name },
          service_radius_km: radius,
        });
        onWorkerReady(worker.id);
      }
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <main className="screen">
      <AppBar onBack={onBack} right={<span className="step-count">3 of 3</span>} />
      <Steps current={3} total={3} />
      <h1 className="h1 mt-20">{role === 'worker' ? 'Your work profile' : 'About you'}</h1>
      <p className="body mt-6">{role === 'worker' ? 'Customers see your name, trade and experience.' : 'Workers see your name once you book them.'}</p>

      <label className="field-label mt-20" htmlFor="name">Full name</label>
      <input id="name" className="input" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />

      <label className="field-label mt-12" htmlFor="phone">Mobile number</label>
      <div className="phone-field">
        <span className="country">+91</span>
        <input id="phone" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
      </div>

      <label className="field-label mt-12" htmlFor="area">Area</label>
      <select id="area" className="input" value={area} onChange={(e) => setArea(e.target.value)}>
        <option value="" disabled>Choose your area</option>
        {session.coords && <option value={CURRENT}>My current location</option>}
        {areas.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
      </select>
      <input className="input mt-6" placeholder={role === 'worker' ? 'Locality (optional)' : 'House / street (optional)'} value={street} maxLength={120} onChange={(e) => setStreet(e.target.value)} />

      {role === 'worker' && (
        <>
          <p className="field-label mt-12">Your trade</p>
          <div className="tag-row">
            {allTrades.map((t) => (
              <button key={t} type="button" className={`tag ${trades.includes(t) ? 'on' : ''}`}
                onClick={() => setTrades(trades.includes(t) ? trades.filter((x) => x !== t) : [...trades, t])}>
                {tradeNames[t].en} · {tradeNames[t].hi}
              </button>
            ))}
          </div>
          <div className="grid-2 mt-12">
            <div>
              <label className="field-label" htmlFor="years">Years of experience</label>
              <input id="years" className="input" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, '').slice(0, 2))} />
            </div>
            <div>
              <p className="field-label">Work within</p>
              <select className="input" value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Work radius">
                {[2, 5, 10, 15, 25].map((km) => <option key={km} value={km}>{km} km</option>)}
              </select>
            </div>
          </div>
        </>
      )}

      {Boolean(error) && <div className="mt-12"><ErrorNote error={error} /></div>}
      <div className="push-bottom">
        <button className="btn btn-primary" type="button" disabled={saving || missing.length > 0} onClick={() => void submit()}>
          {saving ? 'Saving…' : <>Start using LaborLink <ArrowRight size={18} /></>}
        </button>
        {missing.length > 0 && <p className="small center mt-6">Add {missing.join(', ')} to continue.</p>}
      </div>
    </main>
  );
}
