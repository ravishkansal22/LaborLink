'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { isLanguage, languageInfo, type Language } from './languages';

/* The backend has no login yet, so "who am I" is kept on this device (see docs: no authentication).
   Everything else is loaded from the API. */

export type { Language };
export type Role = 'employer' | 'worker';

export interface EmployerProfile {
  name: string;
  phone: string;
  employerId: string; // sent to the API as employer_id
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Session {
  language: Language;
  role: Role | null;
  userId?: string | null;
  employer: EmployerProfile | null;
  workerId: string | null;
  jobIds: string[]; // jobs this employer posted from this device (the API has no "list my jobs" yet)
  coords: { latitude: number; longitude: number } | null;
}

const KEY = 'laborlink.session.v1';
export const emptySession: Session = { 
  language: 'en', 
  role: null, 
  userId: null, 
  employer: null, 
  workerId: null, 
  jobIds: [], 
  coords: null 
};

function isEmployerProfile(value: unknown): value is EmployerProfile {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.name === 'string'
    && typeof e.phone === 'string'
    && typeof e.employerId === 'string'
    && typeof e.address === 'string'
    && (e.latitude === null || typeof e.latitude === 'number')
    && (e.longitude === null || typeof e.longitude === 'number');
}

/** Normalize / reject stale localStorage shapes from older builds so boot never hangs. */
function normalize(raw: unknown): Session {
  if (!raw || typeof raw !== 'object') return { ...emptySession };
  const saved = raw as Record<string, unknown>;
  const language = isLanguage(saved.language) ? saved.language : 'en';
  const role = saved.role === 'employer' || saved.role === 'worker' ? saved.role : null;
  const userId = typeof saved.userId === 'string' ? saved.userId : null;
  const workerId = typeof saved.workerId === 'string' ? saved.workerId : null;
  const employer = isEmployerProfile(saved.employer) ? saved.employer : null;
  const jobIds = Array.isArray(saved.jobIds)
    ? saved.jobIds.filter((id): id is string => typeof id === 'string')
    : [];
  let coords: Session['coords'] = null;
  if (saved.coords && typeof saved.coords === 'object') {
    const c = saved.coords as Record<string, unknown>;
    if (typeof c.latitude === 'number' && typeof c.longitude === 'number') {
      coords = { latitude: c.latitude, longitude: c.longitude };
    }
  }
  return { language, role, userId, employer, workerId, jobIds, coords };
}

function read(): Session {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...emptySession };
    const parsed: unknown = JSON.parse(raw);
    const next = normalize(parsed);
    // Persist the cleaned shape so bad fields (e.g. non-string workerId) don't linger.
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  } catch {
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    return { ...emptySession };
  }
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => { setSession(read()); }, []);
  const update = useCallback((patch: Partial<Session> | ((s: Session) => Partial<Session>)) => {
    setSession((current) => {
      const base = current ?? emptySession;
      const next = { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: keep in memory */ }
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    setSession({ ...emptySession });
  }, []);
  return { session, update, clear };
}

/** Loads data from the API, optionally re-polling every `pollMs` (for live offers/status). */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const value = await loadRef.current();
      setData(value);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (!pollMs) return undefined;
    const timer = window.setInterval(() => void reload(true), pollMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload };
}

/* ------------------------------------------------------------------ speech to text */

interface SpeechResultList { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

const MAX_RECORDING_MS = 25_000; // Sarvam's real-time API is meant for clips under 30 s
const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
export type SpeechEngine = 'browser' | 'server' | 'none';

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Voice-to-text for job descriptions.
 * 1. The browser's own recognizer (Chrome, Edge, Android) is used first: it is free and shows
 *    words live as you speak (`interim`), in all the app's languages.
 * 2. Where the browser has no recognizer (or it can't handle the language), audio is recorded
 *    and transcribed by Sarvam AI through the backend, if the server has a key. This costs
 *    Sarvam credits, so it is only the fallback; the text arrives when you stop.
 */
export function useSpeech(language: Language, onText: (text: string) => void) {
  const [engine, setEngine] = useState<SpeechEngine>('none');
  const [serverReady, setServerReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hasBrowser = Boolean(recognitionCtor());
    const canRecord = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    setEngine(hasBrowser ? 'browser' : 'none');
    if (canRecord) {
      api.speechStatus()
        .then((status) => {
          if (cancelled || !status.available) return;
          setServerReady(true);
          if (!hasBrowser) setEngine('server');
        })
        .catch(() => undefined); // backend unreachable: browser recognition only
    }
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      recRef.current?.stop();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startBrowser = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = languageInfo(language).speech;
    rec.continuous = true;
    rec.interimResults = true; // words appear while you are still speaking
    rec.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) { if (text.trim()) onText(text.trim()); } else pending += text;
      }
      setInterim(pending.trim());
    };
    rec.onerror = (event) => {
      if ((event.error === 'language-not-supported' || event.error === 'network' || event.error === 'service-not-allowed') && serverReady) {
        setEngine('server'); // this browser can't do it: use Sarvam from now on
        setProblem('Live typing isn’t available here. Tap Speak again — your voice will be written down when you stop.');
      } else if (event.error === 'not-allowed') {
        setProblem('Microphone access is blocked. Allow it in the browser, or type instead.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setProblem('Couldn’t hear that. Try again or type instead.');
      }
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [language, onText, serverReady]);

  const startServer = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setProblem('Microphone access is blocked. Allow it in the browser, or type instead.');
      return;
    }
    const mimeType = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setListening(false);
      const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      if (audio.size === 0) { setProblem('Nothing was recorded. Try again.'); return; }
      setTranscribing(true);
      try {
        const result = await api.transcribe(audio, language);
        if (result.transcript) onText(result.transcript);
        else setProblem('Couldn’t make out any words. Try again closer to the phone, or type instead.');
      } catch (err) {
        setProblem(err instanceof Error ? err.message : 'Couldn’t turn that into text. Please type instead.');
      } finally {
        setTranscribing(false);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setListening(true);
    timerRef.current = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, MAX_RECORDING_MS);
  }, [language, onText]);

  const start = useCallback(() => {
    setProblem(null);
    if (engine === 'browser') startBrowser();
    else if (engine === 'server') void startServer();
  }, [engine, startBrowser, startServer]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported: engine !== 'none', engine, listening, interim, transcribing, problem, start, stop };
}
