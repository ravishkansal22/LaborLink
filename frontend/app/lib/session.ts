'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* The backend has no login yet, so "who am I" is kept on this device (see docs: no authentication).
   Everything else is loaded from the API. */

export type Language = 'en' | 'hi';
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
  employer: EmployerProfile | null;
  workerId: string | null;
  jobIds: string[]; // jobs this employer posted from this device (the API has no "list my jobs" yet)
  coords: { latitude: number; longitude: number } | null;
}

const KEY = 'laborlink.session.v1';
export const emptySession: Session = { language: 'en', role: null, employer: null, workerId: null, jobIds: [], coords: null };

function read(): Session {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...emptySession, ...(JSON.parse(raw) as Partial<Session>) } : emptySession;
  } catch {
    return emptySession;
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

/* ------------------------------------------------------------------ speech to text (browser) */

interface SpeechResultList { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

/** Uses the browser's speech recognition (Chrome/Edge). Returns null support if unavailable. */
export function useSpeech(language: Language, onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) onText(event.results[i][0].transcript.trim());
      }
    };
    rec.onerror = (event) => setProblem(event.error === 'not-allowed' ? 'Microphone access is blocked.' : 'Couldn’t hear that. Try again or type instead.');
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setProblem(null);
    setListening(true);
    rec.start();
  }, [language, onText]);

  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { supported, listening, problem, start, stop };
}
