'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BrickWall,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock,
  Droplets,
  FileText,
  Hammer,
  House,
  Image as ImageIcon,
  Info,
  Languages,
  ListChecks,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  Pause,
  Phone,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TriangleAlert,
  UserRound,
  Wrench,
  Zap,
} from 'lucide-react';

type Language = 'en' | 'hi';
type Screen =
  | 'welcome' | 'account' | 'phone' | 'permissions' | 'home' | 'jobs' | 'profile' | 'workerJobs'
  | 'jobDetail' | 'counter' | 'voice' | 'price' | 'offers' | 'tracker' | 'confirm';
type Role = 'employer' | 'worker';

const previousScreen: Record<Screen, Screen> = {
  welcome: 'welcome', account: 'welcome', phone: 'account', permissions: 'phone', home: 'permissions',
  jobs: 'home', profile: 'home', workerJobs: 'profile', jobDetail: 'workerJobs', counter: 'jobDetail',
  voice: 'home', price: 'voice', offers: 'price', tracker: 'offers', confirm: 'tracker',
};

const languages: Array<{ id: Language; badge: string; title: string; subtitle: string }> = [
  { id: 'en', badge: 'En', title: 'English', subtitle: 'For households and contractors' },
  { id: 'hi', badge: 'हिं', title: 'हिंदी', subtitle: 'कारीगर और ठेकेदार के लिए' },
];

/* Real photos can be dropped into frontend/public/photos/ with these names; until then a
   neutral placeholder is shown instead of a stock or AI-generated image. */
const photos = {
  burntSwitch: '/photos/burnt-switch.jpg',
  starterBox: '/photos/starter-box.jpg',
  before: '/photos/before.jpg',
  after: '/photos/after.jpg',
};

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [language, setLanguage] = useState<Language>('en');
  const [role, setRole] = useState<Role>('employer');
  const [phone, setPhone] = useState('9810123456');
  const [otp, setOtp] = useState('482109');
  const [locationGranted, setLocationGranted] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [photoEnabled, setPhotoEnabled] = useState(false);

  // Open a screen directly with ?screen=offers etc. (handy for re-recording one part of a demo video).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('screen');
    if (requested && requested in previousScreen) setScreen(requested as Screen);
  }, []);

  // Each screen starts at the top, like a new page in a native app.
  useEffect(() => {
    document.getElementById('device-scroll')?.scrollTo({ top: 0 });
  }, [screen]);

  const goBack = () => setScreen(previousScreen[screen]);

  switch (screen) {
    case 'welcome':
      return <WelcomeScreen language={language} setLanguage={setLanguage} onContinue={() => setScreen('account')} />;
    case 'account':
      return <AccountScreen role={role} setRole={setRole} onBack={goBack} onContinue={() => setScreen('phone')} />;
    case 'phone':
      return <PhoneScreen phone={phone} setPhone={setPhone} otp={otp} setOtp={setOtp} onBack={goBack} onContinue={() => setScreen('permissions')} />;
    case 'permissions':
      return (
        <PermissionsScreen
          locationGranted={locationGranted} setLocationGranted={setLocationGranted}
          voiceEnabled={voiceEnabled} setVoiceEnabled={setVoiceEnabled}
          photoEnabled={photoEnabled} setPhotoEnabled={setPhotoEnabled}
          onBack={goBack} onContinue={() => setScreen('home')}
        />
      );
    case 'jobs': return <JobsScreen onHome={() => setScreen('home')} onProfile={() => setScreen('profile')} onTracker={() => setScreen('tracker')} />;
    case 'profile': return <ProfileScreen onHome={() => setScreen('home')} onJobs={() => setScreen('jobs')} onWorkerMode={() => setScreen('workerJobs')} />;
    case 'workerJobs': return <WorkerJobsScreen onProfile={goBack} onDetails={() => setScreen('jobDetail')} />;
    case 'jobDetail': return <JobDetailScreen onBack={goBack} onCounter={() => setScreen('counter')} />;
    case 'counter': return <CounterOfferScreen onBack={goBack} />;
    case 'voice': return <VoiceScreen onBack={goBack} onContinue={() => setScreen('price')} />;
    case 'price': return <PriceScreen onBack={goBack} onContinue={() => setScreen('offers')} />;
    case 'offers': return <OffersScreen onBack={goBack} onContinue={() => setScreen('tracker')} />;
    case 'tracker': return <TrackerScreen onBack={goBack} onContinue={() => setScreen('confirm')} />;
    case 'confirm': return <ConfirmScreen onBack={goBack} />;
    default:
      return <HomeScreen onStart={() => setScreen('voice')} onJobs={() => setScreen('jobs')} onProfile={() => setScreen('profile')} onTracker={() => setScreen('tracker')} />;
  }
}

/* ------------------------------------------------------------------ shared pieces */

function AppBar({ title, subtitle, onBack, right }: { title?: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="appbar">
      {onBack ? (
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Go back"><ArrowLeft size={20} /></button>
      ) : <span className="appbar-spacer" />}
      <div className="appbar-title">
        {title && <h1>{title}</h1>}
        {subtitle && <span>{subtitle}</span>}
      </div>
      {right ?? <span className="appbar-spacer" />}
    </header>
  );
}

function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="steps" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < current ? 'on' : ''} />)}
    </div>
  );
}

function Chip({ children, tone = 'plain', icon }: { children: ReactNode; tone?: 'plain' | 'green' | 'orange' | 'red'; icon?: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{icon}{children}</span>;
}

const avatarColors = ['#1e5b46', '#8a4b2a', '#3b5b8c', '#6b4e8c', '#7a6a2e'];
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const color = avatarColors[hash % avatarColors.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.36 }} aria-hidden="true">
      {initials}
    </span>
  );
}

function Photo({ src, label, tag }: { src?: string; label: string; tag?: string }) {
  // The placeholder is always underneath; the real photo is shown on top only once it has loaded.
  const [loaded, setLoaded] = useState(false);
  return (
    <figure className="photo">
      <div className="photo-empty"><ImageIcon size={22} /><span>{label}</span></div>
      {src && (
        <img src={src} alt={label} className={loaded ? 'loaded' : ''}
          ref={(el) => { if (el?.complete && el.naturalWidth > 0) setLoaded(true); }}
          onLoad={() => setLoaded(true)} />
      )}
      {tag && <figcaption>{tag}</figcaption>}
    </figure>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={onChange}>
      <span />
    </button>
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="stars">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= value ? 'filled' : ''} />)}</span>;
}

function JobSteps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="job-steps">
      {labels.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'current' : ''}>
          <span>{i < current ? <Check size={12} strokeWidth={3} /> : null}</span>
          <small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

function BottomNav({ items }: { items: Array<{ label: string; icon: ReactNode; active?: boolean; onClick?: () => void }> }) {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button key={item.label} type="button" className={item.active ? 'active' : ''} onClick={item.onClick}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function employerNav(active: 'home' | 'jobs' | 'profile', go: { home?: () => void; jobs?: () => void; profile?: () => void }) {
  return (
    <BottomNav items={[
      { label: 'Home', icon: <House size={22} />, active: active === 'home', onClick: go.home },
      { label: 'My jobs', icon: <BriefcaseBusiness size={22} />, active: active === 'jobs', onClick: go.jobs },
      { label: 'Profile', icon: <UserRound size={22} />, active: active === 'profile', onClick: go.profile },
    ]} />
  );
}

/* ------------------------------------------------------------------ onboarding */

function WelcomeScreen({ language, setLanguage, onContinue }: { language: Language; setLanguage: (language: Language) => void; onContinue: () => void }) {
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
        <div className="row spread">
          <h2 id="language-heading" className="h3">Choose language</h2>
          <span className="small">भाषा चुनें</span>
        </div>
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
        <p className="small with-icon"><Languages size={15} />You can change this later in Profile.</p>
      </section>

      <div className="push-bottom">
        <button className="btn btn-primary" type="button" onClick={onContinue}>Continue · आगे बढ़ें <ArrowRight size={18} /></button>
        <nav className="footer-links"><a href="#terms">Terms</a><a href="#privacy">Privacy</a><a href="#help">Help</a></nav>
      </div>
    </main>
  );
}

function AccountScreen({ role, setRole, onBack, onContinue }: { role: Role; setRole: (role: Role) => void; onBack: () => void; onContinue: () => void }) {
  return (
    <main className="screen">
      <AppBar onBack={onBack} right={<span className="step-count">1 of 3</span>} />
      <Steps current={1} total={3} />
      <h1 className="h1 mt-20">How will you use LaborLink?</h1>
      <p className="body mt-6">You can switch between hiring and working from your profile.</p>

      <div className="stack mt-20">
        <RoleCard
          active={role === 'employer'} onClick={() => setRole('employer')}
          icon={<BriefcaseBusiness size={22} />} title="I need work done" hindi="मुझे काम करवाना है"
          description="Describe the job with a photo or voice note. Get a price range and offers from workers nearby."
        />
        <RoleCard
          active={role === 'worker'} onClick={() => setRole('worker')}
          icon={<Hammer size={22} />} title="I want work" hindi="मुझे काम चाहिए"
          description="See jobs near you for your trade, send your price, and keep a record of what you earn."
        />
      </div>

      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">
          Continue as {role === 'employer' ? 'employer' : 'worker'} <ArrowRight size={18} />
        </button>
        <p className="small center mt-10">By continuing you agree to the <a href="#terms">Terms</a>.</p>
      </div>
    </main>
  );
}

function RoleCard({ active, icon, title, hindi, description, onClick }: { active: boolean; icon: ReactNode; title: string; hindi: string; description: string; onClick: () => void }) {
  return (
    <button className={`role-card ${active ? 'selected' : ''}`} onClick={onClick} type="button" aria-pressed={active}>
      <span className="role-icon">{icon}</span>
      <span className="role-text">
        <strong>{title}</strong>
        <em>{hindi}</em>
        <small>{description}</small>
      </span>
      <span className="radio" />
    </button>
  );
}

function PhoneScreen({ phone, setPhone, otp, setOtp, onBack, onContinue }: { phone: string; setPhone: (value: string) => void; otp: string; setOtp: (value: string) => void; onBack: () => void; onContinue: () => void }) {
  return (
    <main className="screen">
      <AppBar onBack={onBack} right={<span className="step-count">2 of 3</span>} />
      <Steps current={2} total={3} />
      <h1 className="h1 mt-20">Your phone number</h1>
      <p className="body mt-6">We’ll send a 6-digit code to confirm it’s you.</p>

      <label className="field-label mt-20" htmlFor="phone">Mobile number</label>
      <div className="phone-field">
        <span className="country">+91 <ChevronDown size={14} /></span>
        <input id="phone" inputMode="numeric" autoComplete="tel-national" value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} />
        {phone.length === 10 && <CircleCheck size={20} className="ok" />}
      </div>

      <div className="row spread mt-20">
        <span className="field-label">Code sent by SMS</span>
        <Chip>Demo code 482109</Chip>
      </div>
      <div className="otp">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <input key={index} aria-label={`Digit ${index + 1}`} inputMode="numeric" maxLength={1} value={otp[index] ?? ''}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '');
              setOtp(`${otp.slice(0, index)}${value}${otp.slice(index + 1)}`.slice(0, 6));
            }} />
        ))}
      </div>
      <div className="row spread mt-12">
        <span className="small with-icon"><Clock size={14} />Resend in 0:24</span>
        <button className="link-btn" type="button"><MessageCircle size={15} />Get it on WhatsApp</button>
      </div>

      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">Verify and continue <ArrowRight size={18} /></button>
        <p className="small center mt-10 with-icon centered"><Lock size={13} />We never share your number.</p>
      </div>
    </main>
  );
}

function PermissionsScreen(props: {
  locationGranted: boolean; setLocationGranted: (value: boolean) => void;
  voiceEnabled: boolean; setVoiceEnabled: (value: boolean) => void;
  photoEnabled: boolean; setPhotoEnabled: (value: boolean) => void;
  onBack: () => void; onContinue: () => void;
}) {
  return (
    <main className="screen">
      <AppBar onBack={props.onBack} right={<span className="step-count">3 of 3</span>} />
      <Steps current={3} total={3} />
      <h1 className="h1 mt-20">A few permissions</h1>
      <p className="body mt-6">Only used while you’re posting or doing a job.</p>

      <div className="list mt-20">
        <PermissionRow icon={<Navigation size={20} />} title="Location" tag="Needed"
          description="To show workers within 2–10 km and how far away they are."
          on={props.locationGranted} onChange={() => props.setLocationGranted(!props.locationGranted)} />
        <PermissionRow icon={<Mic size={20} />} title="Microphone" tag="Optional"
          description="To describe the job by voice, in Hindi or English."
          on={props.voiceEnabled} onChange={() => props.setVoiceEnabled(!props.voiceEnabled)} />
        <PermissionRow icon={<Camera size={20} />} title="Camera" tag="Optional"
          description="To send photos of the problem and of the finished work."
          on={props.photoEnabled} onChange={() => props.setPhotoEnabled(!props.photoEnabled)} />
      </div>

      <div className="push-bottom">
        <button className="btn btn-primary" onClick={props.onContinue} type="button">Continue <ArrowRight size={18} /></button>
        <button className="btn btn-ghost mt-6" onClick={props.onContinue} type="button">Not now</button>
      </div>
    </main>
  );
}

function PermissionRow({ icon, title, tag, description, on, onChange }: { icon: ReactNode; title: string; tag: string; description: string; on: boolean; onChange: () => void }) {
  return (
    <div className="list-row align-start">
      <span className="tile-icon">{icon}</span>
      <div className="grow">
        <div className="row gap-6"><strong className="h4">{title}</strong><span className="tiny-tag">{tag}</span></div>
        <p className="small mt-2">{description}</p>
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

/* ------------------------------------------------------------------ employer */

function HomeScreen({ onStart, onJobs, onProfile, onTracker }: { onStart: () => void; onJobs: () => void; onProfile: () => void; onTracker: () => void }) {
  const trades = [
    { name: 'Electrician', icon: <Zap size={20} />, nearby: 9 },
    { name: 'Plumber', icon: <Droplets size={20} />, nearby: 14 },
    { name: 'Mason', icon: <BrickWall size={20} />, nearby: 6 },
    { name: 'Carpenter', icon: <Hammer size={20} />, nearby: 4 },
  ];
  return (
    <main className="screen has-nav">
      <header className="home-head">
        <button className="location-btn" type="button">
          <MapPin size={16} />
          <span><small>Your location</small><strong>Connaught Place, New Delhi <ChevronDown size={14} /></strong></span>
        </button>
        <button className="lang-btn" type="button" aria-label="Change language">हिं</button>
        <button type="button" onClick={onProfile} aria-label="Profile" className="plain"><Avatar name="Arvind Sharma" size={36} /></button>
      </header>

      <h1 className="h1 mt-12">Namaste, Arvind</h1>
      <p className="body mt-2">What needs fixing today?</p>

      <section className="card mt-16">
        <h2 className="h3">Describe the problem</h2>
        <p className="small mt-2">Send a photo or say it in your own words. We’ll turn it into a clear job and a price range.</p>
        <div className="grid-2 mt-12">
          <button type="button" className="big-action" onClick={onStart}><Camera size={22} /><span>Add photo</span></button>
          <button type="button" className="big-action primary" onClick={onStart}><Mic size={22} /><span>Speak<small>Hindi / English</small></span></button>
        </div>
      </section>

      <div className="section-head"><h2 className="h3">Workers near you</h2></div>
      <div className="grid-2">
        {trades.map((trade) => (
          <button key={trade.name} type="button" className="trade-tile" onClick={onStart}>
            <span className="tile-icon">{trade.icon}</span>
            <span><strong>{trade.name}</strong><small>{trade.nearby} nearby</small></span>
          </button>
        ))}
      </div>

      <div className="section-head"><h2 className="h3">Ongoing job</h2><button className="link-btn" type="button" onClick={onTracker}>Track <ChevronRight size={15} /></button></div>
      <article className="card">
        <div className="row spread"><Chip tone="orange" icon={<span className="dot" />}>In progress</Chip><span className="small">Started 10:15 am</span></div>
        <h3 className="h4 mt-10">Pump wiring and MCB trip fix</h3>
        <p className="small">Electrician · Job #8921</p>
        <div className="person mt-12">
          <Avatar name="Manoj Kumar" />
          <div className="grow"><strong>Manoj Kumar</strong><span className="row gap-4"><Stars value={5} size={12} /> 4.9 · 184 jobs</span></div>
          <a className="icon-btn green" href="tel:+910000000000" aria-label="Call Manoj"><Phone size={18} /></a>
        </div>
        <JobSteps labels={['Booked', 'Started', 'Photos sent', 'Confirmed']} current={1} />
      </article>

      {employerNav('home', { jobs: onJobs, profile: onProfile })}
    </main>
  );
}

function JobsScreen({ onHome, onProfile, onTracker }: { onHome: () => void; onProfile: () => void; onTracker: () => void }) {
  return (
    <main className="screen has-nav">
      <AppBar title="My jobs" right={<span className="appbar-spacer" />} />
      <div className="segmented"><span className="on">Ongoing (1)</span><span>Completed (8)</span></div>

      <article className="card mt-16">
        <div className="row spread"><Chip tone="orange" icon={<span className="dot" />}>In progress</Chip><strong className="amount">₹640</strong></div>
        <h3 className="h4 mt-10">Pump wiring and MCB trip fix</h3>
        <p className="small">Job #LL-8942 · Connaught Place</p>
        <div className="person mt-12">
          <Avatar name="Manoj Kumar" />
          <div className="grow"><strong>Manoj Kumar</strong><span>Phone verified</span></div>
          <span className="row gap-4 small"><Star size={13} className="filled" />4.9</span>
        </div>
        <div className="row spread mt-12 small"><span>Worker is on site</span><span>About 15 min left</span></div>
        <div className="progress mt-6"><span style={{ width: '70%' }} /></div>
        <button className="btn btn-secondary mt-12" type="button" onClick={onTracker}>Open job tracker</button>
      </article>

      <div className="section-head"><h2 className="h3">Completed</h2><span className="small">8 jobs</span></div>
      <div className="stack">
        <PastJob icon={<Droplets size={18} />} trade="Plumbing" date="12 Oct" title="Kitchen tap pipe leak" worker="Ramesh Yadav" amount="₹450" />
        <PastJob icon={<Zap size={18} />} trade="Electrical" date="28 Sep" title="Ceiling fan rewiring" worker="Suresh Kumar" amount="₹380" />
      </div>

      {employerNav('jobs', { home: onHome, profile: onProfile })}
    </main>
  );
}

function PastJob({ icon, trade, date, title, worker, amount }: { icon: ReactNode; trade: string; date: string; title: string; worker: string; amount: string }) {
  return (
    <article className="card">
      <div className="row align-start">
        <span className="tile-icon">{icon}</span>
        <div className="grow">
          <p className="small">{trade} · {date}</p>
          <h3 className="h4">{title}</h3>
          <span className="row gap-6 small mt-6"><Avatar name={worker} size={22} />{worker}</span>
        </div>
        <div className="right">
          <Chip tone="green">Done</Chip>
          <strong className="amount mt-6">{amount}</strong>
        </div>
      </div>
      <div className="grid-2 mt-12">
        <button className="btn btn-small btn-secondary" type="button"><FileText size={15} />Receipt</button>
        <button className="btn btn-small btn-secondary" type="button"><RefreshCw size={15} />Book again</button>
      </div>
    </article>
  );
}

function ProfileScreen({ onHome, onJobs, onWorkerMode }: { onHome: () => void; onJobs: () => void; onWorkerMode: () => void }) {
  return (
    <main className="screen has-nav">
      <AppBar title="Profile" right={<span className="appbar-spacer" />} />
      <section className="profile-head">
        <Avatar name="Arvind Sharma" size={64} />
        <div>
          <h2 className="h2">Arvind Sharma</h2>
          <p className="small">Employer · +91 98101 23456</p>
          <span className="row gap-4 small mt-2"><BadgeCheck size={14} className="green-text" />Phone verified</span>
        </div>
      </section>

      <section className="card mt-16">
        <div className="row spread"><h3 className="h4">Ongoing job</h3><Chip tone="orange">1 active</Chip></div>
        <div className="row mt-10">
          <span className="tile-icon"><Wrench size={18} /></span>
          <div className="grow"><strong>Pump wiring and MCB fix</strong><p className="small">Manoj Kumar · agreed ₹640</p></div>
        </div>
      </section>

      <p className="list-title">Settings</p>
      <div className="list">
        <SettingRow icon={<Languages size={18} />} title="Language · भाषा" detail="English" />
        <SettingRow icon={<MapPin size={18} />} title="Saved addresses" detail="Flat 402, Connaught Place" />
        <SettingRow icon={<Clock size={18} />} title="Usual urgency" detail="Within 2 hours" />
        <SettingRow icon={<RefreshCw size={18} />} title="Switch to worker mode" detail="Find work near you" onClick={onWorkerMode} />
        <SettingRow icon={<CircleHelp size={18} />} title="Help" detail="Call or chat with us" />
      </div>

      <button className="btn btn-ghost danger mt-16" type="button"><LogOut size={17} />Sign out</button>
      <p className="small center">LaborLink prototype · v0.3</p>

      {employerNav('profile', { home: onHome, jobs: onJobs })}
    </main>
  );
}

function SettingRow({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick?: () => void }) {
  return (
    <button type="button" className="list-row" onClick={onClick}>
      <span className="tile-icon small-tile">{icon}</span>
      <span className="grow"><strong className="h4">{title}</strong><small className="small block">{detail}</small></span>
      <ChevronRight size={18} className="muted" />
    </button>
  );
}

/* ------------------------------------------------------------------ worker */

function WorkerJobsScreen({ onProfile, onDetails }: { onProfile: () => void; onDetails: () => void }) {
  const [radius, setRadius] = useState(5);
  const [online, setOnline] = useState(true);
  return (
    <main className="screen has-nav">
      <header className="home-head">
        <div className="grow">
          <h1 className="h2">Jobs near you</h1>
          <p className="small with-icon"><MapPin size={13} />Lajpat Nagar · Electrician</p>
        </div>
        <span className={`online ${online ? 'on' : ''}`}>{online ? 'Online' : 'Offline'}</span>
        <Toggle on={online} onChange={() => setOnline(!online)} label="Available for work" />
      </header>

      <div className="row gap-6 mt-12">
        {[2, 5, 10].map((km) => (
          <button key={km} type="button" className={`seg-btn ${radius === km ? 'on' : ''}`} onClick={() => setRadius(km)}>{km} km</button>
        ))}
        <button type="button" className="seg-btn icon" aria-label="Filters"><SlidersHorizontal size={16} /></button>
      </div>

      <div className="section-head"><h2 className="h3">3 new jobs</h2><span className="small">Updated just now</span></div>
      <div className="stack">
        <WorkerLead urgent onDetails={onDetails} title="Pump wiring and MCB trip fix" client="Arvind S." area="Connaught Place" distance="1.8 km" range="₹480 – ₹620" suggested="₹550" />
        <WorkerLead title="Meter board rewiring" client="DLF office" area="Saket" distance="3.2 km" range="₹750 – ₹920" suggested="₹840" />
        <WorkerLead title="Kitchen exhaust wiring" client="Sweet Corner Cafe" area="Defence Colony" distance="4.1 km" range="₹380 – ₹450" suggested="₹420" />
      </div>

      <div className="note mt-16">
        <Info size={18} />
        <p><strong>FairRate</strong> Offers must stay within each job’s price range, so nobody can undercut your rate.</p>
      </div>

      <BottomNav items={[
        { label: 'Jobs', icon: <BriefcaseBusiness size={22} />, active: true },
        { label: 'Passbook', icon: <BookOpen size={22} /> },
        { label: 'Profile', icon: <UserRound size={22} />, onClick: onProfile },
      ]} />
    </main>
  );
}

function WorkerLead({ urgent = false, onDetails, title, client, area, distance, range, suggested }: { urgent?: boolean; onDetails?: () => void; title: string; client: string; area: string; distance: string; range: string; suggested: string }) {
  return (
    <article className="card">
      <div className="row spread">
        {urgent ? <Chip tone="red" icon={<Clock size={13} />}>Today, within 2 h</Chip> : <Chip>Scheduled</Chip>}
        <span className="small with-icon"><Navigation size={13} />{distance}</span>
      </div>
      <h3 className="h4 mt-10">{title}</h3>
      <p className="small">{client} · {area}</p>
      {urgent && <div className="grid-2 mt-10"><Photo src={photos.burntSwitch} label="Burnt switch" /><Photo src={photos.starterBox} label="Starter box" /></div>}
      <div className="price-row mt-12">
        <div><small>Price range</small><strong>{range}</strong></div>
        <div className="right"><small>Suggested</small><strong>{suggested}</strong></div>
      </div>
      <div className="grid-2 mt-12">
        <button className="btn btn-small btn-secondary" type="button"><Play size={15} />Listen</button>
        <button className="btn btn-small btn-primary" type="button" onClick={onDetails}>View job</button>
      </div>
    </article>
  );
}

function JobDetailScreen({ onBack, onCounter }: { onBack: () => void; onCounter: () => void }) {
  return (
    <main className="screen">
      <AppBar title="Job details" onBack={onBack} />
      <div className="row gap-6"><Chip tone="red" icon={<Clock size={13} />}>Urgent</Chip><Chip>Offers close in 12 min</Chip></div>
      <h1 className="h1 mt-12">Pump wiring and MCB trip fix</h1>
      <p className="small with-icon mt-6"><MapPin size={13} />Connaught Place · 2.4 km away</p>

      <section className="card mt-16">
        <div className="row spread"><h2 className="h4">Photos from customer</h2><span className="small">2</span></div>
        <div className="grid-2 mt-10"><Photo src={photos.burntSwitch} label="Burnt switch" /><Photo src={photos.starterBox} label="Starter box" /></div>
      </section>

      <section className="card mt-12">
        <div className="row">
          <button className="play-btn" type="button" aria-label="Play voice note"><Play size={16} /></button>
          <div className="grow"><strong className="h4">Voice note</strong><p className="small">Hindi · 0:14</p></div>
          <span className="small">0:00 / 0:14</span>
        </div>
        <blockquote className="quote mt-10">“Bathroom pump switch on karte hi MCB trip hoti hai. Subah se paani band hai. Jaldi aao.”</blockquote>
      </section>

      <section className="card mt-12">
        <h2 className="h4">You’ll likely need</h2>
        <ul className="checklist mt-10">
          <li><Check size={16} /><span><strong>Multimeter or voltage tester</strong><small>To find the short circuit</small></span></li>
          <li><Check size={16} /><span><strong>32A MCB</strong><small>Replacement part, billed separately</small></span></li>
          <li><Check size={16} /><span><strong>4 sq mm copper wire and tape</strong><small>If the old wire is burnt</small></span></li>
        </ul>
      </section>

      <section className="card price-card mt-12">
        <p className="small">FairRate price range</p>
        <strong className="big-amount">₹480 – ₹620</strong>
        <p className="small mt-6">Offers can’t go below ₹480, so the work is never under-priced.</p>
      </section>

      <section className="card mt-12">
        <p className="small">Posted by</p>
        <div className="person mt-6">
          <Avatar name="Arvind Sharma" size={38} />
          <div className="grow"><strong>Arvind Sharma</strong><span>18 jobs posted · phone verified</span></div>
        </div>
      </section>

      <div className="grid-2 mt-20 sticky-actions">
        <button className="btn btn-secondary" type="button" onClick={onCounter}>Counter offer</button>
        <button className="btn btn-primary" type="button" onClick={() => window.alert('Offer of ₹550 sent (demo).')}>Accept ₹550</button>
      </div>
    </main>
  );
}

function CounterOfferScreen({ onBack }: { onBack: () => void }) {
  const [amount, setAmount] = useState(560);
  const min = 480;
  const max = 680;
  const tags = ['Can arrive in 20 min', 'Carrying a spare 32A MCB', '8 years experience'];
  const [chosen, setChosen] = useState<string[]>(tags.slice(0, 2));
  const toggle = (tag: string) => setChosen(chosen.includes(tag) ? chosen.filter((t) => t !== tag) : [...chosen, tag]);
  return (
    <main className="screen">
      <AppBar title="Your offer" subtitle="Pump wiring and MCB fix" onBack={onBack} />

      <section className="card center">
        <p className="small">Your price</p>
        <strong className="huge-amount">₹{amount}</strong>
        <p className="small">Customer’s range ₹480 – ₹620</p>
        <input className="slider mt-16" type="range" min={min} max={max} step={10} value={amount}
          onChange={(event) => setAmount(Number(event.target.value))} aria-label="Offer amount" />
        <div className="row spread small"><span>₹{min}</span><span>₹{max}</span></div>
      </section>

      <div className="note mt-12"><Info size={18} /><p>Offers below ₹{min} aren’t allowed. This keeps pay fair for everyone.</p></div>

      <section className="card mt-12">
        <h2 className="h4">How your price adds up</h2>
        <div className="lines mt-10">
          <p><span>Labour and fault finding</span><strong>₹{amount - 120}</strong></p>
          <p><span>Travel</span><strong>₹60</strong></p>
          <p><span>32A MCB (part)</span><strong>₹60</strong></p>
          <p className="total"><span>Total</span><strong>₹{amount}</strong></p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="h4">Add a note for the customer</h2>
        <div className="tag-row mt-10">
          {tags.map((tag) => (
            <button key={tag} type="button" className={`tag ${chosen.includes(tag) ? 'on' : ''}`} onClick={() => toggle(tag)}>
              {chosen.includes(tag) && <Check size={14} />}{tag}
            </button>
          ))}
        </div>
      </section>

      <div className="push-bottom">
        <button className="btn btn-primary" type="button" onClick={() => window.alert(`Offer of ₹${amount} sent (demo).`)}><Send size={17} />Send offer · ₹{amount}</button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ job request flow */

function VoiceScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [recording, setRecording] = useState(true);
  const bars = [10, 22, 34, 18, 40, 26, 14, 32, 24, 12, 30, 20, 36, 16, 28, 12, 22, 34, 18, 26];
  return (
    <main className="screen">
      <AppBar title="New job" subtitle="Step 1 of 3 · Describe" onBack={onBack} />
      <h1 className="h1">Tell us what’s wrong</h1>
      <p className="body mt-6">Speak in Hindi, English or a mix. You can edit the text after.</p>

      <section className="recorder mt-16">
        <div className="row spread">
          <span className="rec-label"><span className={`rec-dot ${recording ? 'live' : ''}`} />{recording ? 'Recording' : 'Paused'}</span>
          <span className="rec-time">0:21</span>
        </div>
        <div className={`wave ${recording ? 'live' : ''}`}>{bars.map((h, i) => <i key={i} style={{ height: h }} />)}</div>
        <button className="mic-btn" type="button" onClick={() => setRecording(!recording)} aria-label={recording ? 'Pause recording' : 'Resume recording'}>
          {recording ? <Pause size={26} /> : <Mic size={26} />}
        </button>
      </section>

      <section className="card mt-16">
        <div className="row spread"><span className="small">What we heard</span><button className="link-btn" type="button">Edit</button></div>
        <p className="transcript mt-6">“Bathroom ka submersible pump switch on karte hi MCB trip ho rahi hai. Wire jalne ki smell aa rahi hai. Aaj shaam tak theek chahiye.”</p>
        <div className="tag-row mt-10"><Chip tone="green" icon={<Zap size={13} />}>Electrician</Chip><Chip>Pump circuit</Chip><Chip tone="red">Urgent</Chip></div>
      </section>

      <div className="section-head"><h2 className="h4">Photos</h2><span className="small">2 added</span></div>
      <div className="grid-3">
        <Photo src={photos.burntSwitch} label="MCB box" />
        <Photo src={photos.starterBox} label="Motor wire" />
        <button className="photo add-photo" type="button" aria-label="Add photo"><Camera size={20} /><span>Add</span></button>
      </div>

      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">See price estimate <ArrowRight size={18} /></button>
      </div>
    </main>
  );
}

function PriceScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <main className="screen">
      <AppBar title="New job" subtitle="Step 2 of 3 · Price" onBack={onBack} />

      <section className="card price-card">
        <p className="small">Fair price for this job</p>
        <strong className="huge-amount">₹480 – ₹620</strong>
        <p className="small">Pump wiring and MCB trip fix · Electrician</p>
      </section>

      <section className="card mt-12">
        <h2 className="h4">How we worked it out</h2>
        <div className="lines mt-10">
          <p><span>Labour · about 1.2 hours at ₹350/hr</span><strong>₹420</strong></p>
          <p><span>Travel · 3.4 km</span><strong>₹60</strong></p>
          <p><span>Urgent request</span><strong>+ up to ₹140</strong></p>
          <p className="total"><span>Lowest offer allowed</span><strong>₹480</strong></p>
        </div>
        <p className="small mt-10">Parts like a new MCB are extra and agreed with the worker before work starts.</p>
      </section>

      <div className="person card mt-12">
        <span className="tile-icon"><UserRound size={18} /></span>
        <div className="grow"><strong>8 electricians nearby</strong><span>Usually reply in about 3 min</span></div>
        <ChevronRight size={18} className="muted" />
      </div>

      <div className="note mt-12"><Info size={18} /><p>This is an estimate. The final price is what you and the worker agree on.</p></div>

      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">Send to nearby workers <ArrowRight size={18} /></button>
      </div>
    </main>
  );
}

function OffersScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [sort, setSort] = useState('Best match');
  return (
    <main className="screen">
      <AppBar title="New job" subtitle="Step 3 of 3 · Choose a worker" onBack={onBack} />
      <div className="row spread"><h1 className="h1">3 offers</h1><span className="small with-icon"><Clock size={13} />14 min left</span></div>
      <p className="body mt-2">All offers are within the ₹480 – ₹620 range.</p>

      <div className="row gap-6 mt-12 scroll-x">
        {['Best match', 'Nearest', 'Lowest price'].map((label) => (
          <button key={label} type="button" className={`seg-btn ${sort === label ? 'on' : ''}`} onClick={() => setSort(label)}>{label}</button>
        ))}
      </div>

      <div className="stack mt-12">
        <OfferCard featured name="Manoj Kumar" role="Electrician · 8 yrs" rating={4.9} jobs={184} price="₹520" distance="1.8 km · 20 min" note="I have a multimeter and copper wire with me. Did a similar job yesterday." onContinue={onContinue} />
        <OfferCard name="Suresh Prajapati" role="Wireman · 5 yrs" rating={4.7} jobs={92} price="₹480" distance="2.5 km" />
        <OfferCard name="Vikram Singh" role="Electrician · 11 yrs" rating={4.8} jobs={240} price="₹550" distance="3.1 km" />
      </div>
    </main>
  );
}

function OfferCard({ featured = false, name, role, rating, jobs, price, distance, note, onContinue }: { featured?: boolean; name: string; role: string; rating: number; jobs: number; price: string; distance: string; note?: string; onContinue?: () => void }) {
  return (
    <article className={`card ${featured ? 'card-featured' : ''}`}>
      {featured && <Chip tone="green">Best match</Chip>}
      <div className={`person ${featured ? 'mt-10' : ''}`}>
        <Avatar name={name} size={48} />
        <div className="grow">
          <strong>{name}</strong>
          <span>{role}</span>
          <span className="row gap-4"><Star size={12} className="filled" />{rating} · {jobs} jobs · {distance}</span>
        </div>
        <strong className="offer-price">{price}</strong>
      </div>
      {note && <p className="quote mt-10">“{note}”</p>}
      <button className={`btn btn-small mt-12 ${featured ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={onContinue}>
        {featured ? `Book Manoj for ${price}` : 'View offer'}
      </button>
    </article>
  );
}

function TrackerScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <main className="screen">
      <AppBar title="Job #88241" subtitle="Pump wiring and MCB fix" onBack={onBack} />

      <section className="card">
        <div className="row spread"><Chip tone="orange" icon={<span className="dot" />}>Work in progress</Chip><span className="small">35 min so far</span></div>
        <JobSteps labels={['Booked', 'Started', 'Photos sent', 'Confirmed']} current={2} />
      </section>

      <section className="card mt-12">
        <div className="person">
          <Avatar name="Manoj Kumar" size={48} />
          <div className="grow"><strong>Manoj Kumar</strong><span>Electrician · phone verified</span><span className="row gap-4"><Star size={12} className="filled" />4.9 · 218 jobs</span></div>
        </div>
        <div className="grid-2 mt-12">
          <button className="btn btn-small btn-secondary" type="button"><Phone size={15} />Call</button>
          <button className="btn btn-small btn-secondary" type="button"><MessageCircle size={15} />Message</button>
        </div>
      </section>

      <section className="card mt-12">
        <div className="row align-start">
          <span className="tile-icon"><TriangleAlert size={18} /></span>
          <div className="grow">
            <div className="row spread"><strong className="h4">Extra part added</strong><Chip tone="green">You approved</Chip></div>
            <p className="small mt-2">New 32A MCB breaker · + ₹120</p>
          </div>
        </div>
      </section>

      <section className="card mt-12">
        <h2 className="h4 with-icon"><ListChecks size={17} />Work checklist</h2>
        <ul className="checklist mt-10">
          <li className="done"><CircleCheck size={17} /><span>Main power switched off before wiring</span></li>
          <li className="done"><CircleCheck size={17} /><span>Wire joints insulated and sealed</span></li>
          <li><span className="hollow" /><span>Pump water flow tested</span></li>
        </ul>
      </section>

      <section className="card mt-12">
        <div className="row spread"><h2 className="h4">Photos from the worker</h2><span className="small">2</span></div>
        <div className="grid-2 mt-10"><Photo src={photos.before} label="Before" tag="Before" /><Photo src={photos.after} label="After" tag="After" /></div>
      </section>

      <div className="push-bottom">
        <button className="btn btn-primary" onClick={onContinue} type="button">Check work and confirm <ArrowRight size={18} /></button>
      </div>
    </main>
  );
}

function ConfirmScreen({ onBack }: { onBack: () => void }) {
  const [rating, setRating] = useState(0);
  const compliments = ['On time', 'Clean work', 'Polite', 'Knew the job'];
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <main className="screen">
      <AppBar title="Confirm work" onBack={onBack} />
      <h1 className="h1">Is the job done?</h1>
      <p className="body mt-6">Check the photos and the work before you confirm.</p>

      <section className="card mt-16">
        <div className="row spread"><h2 className="h4">Before and after</h2><span className="small">Today, 4:42 pm</span></div>
        <div className="grid-2 mt-10">
          <Photo src={photos.before} label="Burnt MCB" tag="Before" />
          <Photo src={photos.after} label="New breaker" tag="After" />
        </div>
        <ul className="checklist mt-12">
          <li className="done"><CircleCheck size={17} /><span>Pump tested and running</span></li>
          <li className="done"><CircleCheck size={17} /><span>MCB no longer trips</span></li>
          <li className="done"><CircleCheck size={17} /><span>Work area cleaned</span></li>
        </ul>
      </section>

      <section className="card mt-12">
        <h2 className="h4">Payment</h2>
        <div className="lines mt-10">
          <p><span>Labour (agreed)</span><strong>₹520</strong></p>
          <p><span>32A breaker</span><strong>₹120</strong></p>
          <p className="total"><span>Total</span><strong>₹640</strong></p>
        </div>
        <p className="small mt-10 with-icon"><Info size={13} />Demo payment — no real money is moved.</p>
      </section>

      <section className="card mt-12">
        <div className="person">
          <Avatar name="Manoj Kumar" size={40} />
          <div className="grow"><strong>Rate Manoj</strong><span>Helps other customers choose</span></div>
        </div>
        <div className="rate-row mt-12">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
              <Star size={30} className={n <= rating ? 'filled' : ''} />
            </button>
          ))}
        </div>
        <div className="tag-row mt-12">
          {compliments.map((c) => (
            <button key={c} type="button" className={`tag ${picked.includes(c) ? 'on' : ''}`}
              onClick={() => setPicked(picked.includes(c) ? picked.filter((p) => p !== c) : [...picked, c])}>{c}</button>
          ))}
        </div>
      </section>

      <div className="push-bottom">
        <button className="btn btn-primary" type="button" onClick={() => window.alert('Work confirmed. Demo payment of ₹640 recorded.')}>
          <ShieldCheck size={18} />Confirm and pay ₹640
        </button>
        <button className="btn btn-ghost danger mt-6" type="button" onClick={() => window.alert('Problem reported. The job will not be paid until it is sorted out.')}>
          Something’s wrong — report a problem
        </button>
      </div>
    </main>
  );
}

export default App;
