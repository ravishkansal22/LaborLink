'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

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
const MAX_RECORDING_MS = 25_000; // Sarvam's real-time API is meant for clips under 30 s
const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
type SpeechEngine = 'server' | 'browser' | 'none';

/**
 * Voice-to-text for job descriptions. Uses Sarvam AI through the backend when the server has a
 * key (works in any browser that can record audio, good with Hindi/Hinglish); otherwise falls
 * back to the browser's own SpeechRecognition (Chrome/Edge).
 */
export function useSpeech(language: Language, onText: (text: string) => void) {
  const [engine, setEngine] = useState<SpeechEngine>('none');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const browser = Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
    const canRecord = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    setEngine(browser ? 'browser' : 'none');
    if (canRecord) {
      api.speechStatus()
        .then((status) => { if (!cancelled && status.available) setEngine('server'); })
        .catch(() => undefined); // backend down or old: keep the browser engine
    }
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startBrowser = useCallback(() => {
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
    setListening(true);
    rec.start();
  }, [language, onText]);

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
    if (engine === 'server') void startServer();
    else if (engine === 'browser') startBrowser();
  }, [engine, startBrowser, startServer]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported: engine !== 'none', engine, listening, transcribing, problem, start, stop };
}
