'use client';

import { useSyncExternalStore } from 'react';
import { api } from './api';
import { languageInfo, type Language } from './languages';
import { overrides } from './overrides';

/*
 * App translation. Text is written in English and wrapped in t(): t('Book a worker'),
 * t('Arriving in {n} min', { n: 5 }). For any other language, missing strings are collected,
 * sent in batches to the backend (/api/v1/translate → Sarvam AI, cached in the database), and
 * kept in localStorage, so each phone fetches each string only once. Until a translation
 * arrives the English text is shown. The page root subscribes with useTranslations(), so
 * the whole screen re-renders when new translations land.
 *
 * tx() is for user-written content (job descriptions, summaries): its language is detected.
 */

type Vars = Record<string, string | number>;
type Source = 'en' | 'auto';

const STORE_PREFIX = 'laborlink.i18n.v2.';
const BATCH = 150;

let current: Language = 'en';
const dictionaries: Partial<Record<Language, Record<string, string>>> = {};
const requested = new Set<string>(); // "lang|source|text" asked for in this page load
const queue = new Map<Source, Set<string>>();
let timer: number | null = null;
let unavailable = false; // the server has no Sarvam key: stop asking
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  listeners.forEach((fn) => fn());
}

function keyFor(source: Source, text: string) {
  return source === 'en' ? text : `auto:${text}`;
}

function dictionary(language: Language): Record<string, string> {
  let dict = dictionaries[language];
  if (!dict) {
    dict = {};
    try {
      const raw = window.localStorage.getItem(STORE_PREFIX + language);
      if (raw) dict = JSON.parse(raw) as Record<string, string>;
    } catch { /* private mode or bad data: start empty */ }
    dictionaries[language] = dict;
  }
  return dict;
}

function save(language: Language) {
  try { window.localStorage.setItem(STORE_PREFIX + language, JSON.stringify(dictionaries[language] ?? {})); } catch { /* full or blocked */ }
}

async function flush() {
  timer = null;
  const language = current;
  for (const [source, texts] of queue) {
    const all = [...texts];
    texts.clear();
    for (let i = 0; i < all.length; i += BATCH) {
      const batch = all.slice(i, i + BATCH);
      try {
        const result = await api.translate(batch, language, source);
        if (!result.available) unavailable = true;
        const dict = dictionary(language);
        result.translations.forEach((value, index) => {
          if (value) dict[keyFor(source, batch[index])] = value;
        });
        save(language);
        notify();
      } catch {
        // Server unreachable or error: keep English for now; retried on the next page load.
      }
    }
  }
}

function request(text: string, source: Source) {
  if (unavailable || typeof window === 'undefined') return;
  const id = `${current}|${source}|${text}`;
  if (requested.has(id)) return;
  requested.add(id);
  if (!queue.has(source)) queue.set(source, new Set());
  queue.get(source)!.add(text);
  if (timer === null) timer = window.setTimeout(() => void flush(), 120);
}

function fill(text: string, vars?: Vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

function lookup(text: string, source: Source, vars?: Vars): string {
  if (!text || current === 'en' || typeof window === 'undefined') return fill(text, vars);
  const fixed = source === 'en' ? overrides[current]?.[text] : undefined;
  if (fixed) return fill(fixed, vars);
  const hit = dictionary(current)[keyFor(source, text)];
  if (hit) return fill(hit, vars);
  request(text, source);
  return fill(text, vars);
}

/** Translate app text written in English. Use {name} placeholders for values. */
export function t(text: string, vars?: Vars): string {
  return lookup(text, 'en', vars);
}

/** Translate user-written text whose language is unknown (job descriptions, summaries). */
export function tx(text: string | null | undefined): string {
  return text ? lookup(text, 'auto') : '';
}

export function setLanguage(language: Language) {
  if (language === current) return;
  current = language;
  unavailable = false;
  document.documentElement.lang = languageInfo(language).speech;
  notify();
}

export function currentLanguage(): Language {
  return current;
}

/** Subscribe the page root so it re-renders when the language or translations change. */
export function useTranslations(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => version,
    () => 0,
  );
}
