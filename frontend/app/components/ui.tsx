'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, Image as ImageIcon, Info, Loader, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { api, errorText, type JobStatus } from '../lib/api';

export function AppBar({ title, subtitle, onBack, right }: { title?: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="appbar">
      {onBack ? <button className="icon-btn" type="button" onClick={onBack} aria-label="Go back"><ArrowLeft size={20} /></button> : <span className="appbar-spacer" />}
      <div className="appbar-title">{title && <h1>{title}</h1>}{subtitle && <span>{subtitle}</span>}</div>
      {right ?? <span className="appbar-spacer" />}
    </header>
  );
}

export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="steps" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < current ? 'on' : ''} />)}
    </div>
  );
}

export type Tone = 'plain' | 'green' | 'orange' | 'red';
export function Chip({ children, tone = 'plain', icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{icon}{children}</span>;
}

const avatarColors = ['#0758d8', '#29335b', '#08799e', '#5b4bb7', '#b4533c'];
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <span className="avatar" style={{ width: size, height: size, background: avatarColors[hash % avatarColors.length], fontSize: size * 0.36 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Photo({ src, label, tag }: { src: string; label: string; tag?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <figure className="photo">
      <div className="photo-empty"><ImageIcon size={22} /><span>{label}</span></div>
      <img src={src} alt={label} className={loaded ? 'loaded' : ''}
        ref={(el) => { if (el?.complete && el.naturalWidth > 0) setLoaded(true); }}
        onLoad={() => setLoaded(true)} />
      {tag && <figcaption>{tag}</figcaption>}
    </figure>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`toggle ${on ? 'on' : ''}`} onClick={onChange}>
      <span />
    </button>
  );
}

export function JobSteps({ labels, current, waiting = false }: { labels: string[]; current: number; waiting?: boolean }) {
  return (
    <ol className="job-steps">
      {labels.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current && !waiting ? 'current' : ''}>
          <span>{i < current ? <Check size={12} strokeWidth={3} /> : null}</span>
          <small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

export function BottomNav({ items }: { items: Array<{ label: string; icon: ReactNode; active?: boolean; onClick?: () => void }> }) {
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

export function SettingRow({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick?: () => void }) {
  return (
    <button type="button" className="list-row" onClick={onClick} disabled={!onClick}>
      <span className="tile-icon small-tile">{icon}</span>
      <span className="grow"><strong className="h4">{title}</strong><small className="small block">{detail}</small></span>
      {onClick && <ChevronRight size={18} className="muted" />}
    </button>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading"><Loader size={20} className="spin" /><span>{label}</span></div>;
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert">
      <TriangleAlert size={18} />
      <p>{errorText(error)}</p>
      {onRetry && <button type="button" onClick={onRetry} aria-label="Try again"><RefreshCw size={16} /></button>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="tile-icon">{icon}</span>
      <strong className="h4">{title}</strong>
      <p className="small">{text}</p>
      {action}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="note"><Info size={18} /><p>{children}</p></div>;
}

/* ------------------------------------------------------------------ job status */

export const statusInfo: Record<JobStatus, { label: string; tone: Tone; live?: boolean }> = {
  needs_information: { label: 'Needs more detail', tone: 'red' },
  estimated: { label: 'Waiting for offers', tone: 'plain' },
  booked: { label: 'Worker booked', tone: 'green' },
  in_progress: { label: 'Work in progress', tone: 'orange', live: true },
  awaiting_confirmation: { label: 'Waiting for confirmation', tone: 'orange', live: true },
  completed: { label: 'Completed', tone: 'green' },
  disputed: { label: 'Problem reported', tone: 'red' },
};

export function StatusChip({ status, label }: { status: JobStatus; label?: string }) {
  const info = statusInfo[status];
  return <Chip tone={info.tone} icon={info.live ? <span className="dot" /> : undefined}>{label ?? info.label}</Chip>;
}

export const stepLabels = ['Booked', 'Started', 'Photos sent', 'Confirmed'];
export function stepsFor(status: JobStatus): { current: number; waiting: boolean } {
  switch (status) {
    case 'booked': return { current: 1, waiting: true };
    case 'in_progress': return { current: 2, waiting: false };
    case 'awaiting_confirmation': return { current: 3, waiting: false };
    case 'completed': return { current: 4, waiting: false };
    case 'disputed': return { current: 3, waiting: true };
    default: return { current: 0, waiting: true };
  }
}

/* ------------------------------------------------------------------ photo picker (uploads to the API) */

export interface PickedPhoto { id: string; preview: string }

export function PhotoPicker({ photos, onChange, max, label }: { photos: PickedPhoto[]; onChange: (photos: PickedPhoto[]) => void; max: number; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: PickedPhoto[] = [];
    try {
      for (const file of Array.from(files).slice(0, max - photos.length)) {
        const uploaded = await api.uploadImage(file);
        added.push({ id: uploaded.id, preview: URL.createObjectURL(file) });
      }
    } catch (err) {
      setError(err);
    } finally {
      onChange([...photos, ...added]);
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <div className="grid-3">
        {photos.map((photo, i) => (
          <div key={photo.id} className="picked">
            <Photo src={photo.preview} label={`${label} ${i + 1}`} />
            <button type="button" aria-label="Remove photo" onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}><X size={14} /></button>
          </div>
        ))}
        {photos.length < max && (
          <button className="photo add-photo" type="button" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader size={20} className="spin" /> : <Camera size={20} />}
            <span>{busy ? 'Uploading' : `Add ${label.toLowerCase()}`}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple hidden
        onChange={(event) => void pick(event.target.files)} />
      {Boolean(error) && <div className="mt-6"><ErrorNote error={error} /></div>}
    </>
  );
}
