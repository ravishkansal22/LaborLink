'use client';

/**
 * Profile-scoped theme (Phase A). Applies `data-theme` + `color-scheme` to the
 * phone container (`.device-screen`) so portaled sheets inherit tokens.
 * Does not touch `document.documentElement` / `body`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadThemePreference, saveThemePreference } from './storage';
import type { ResolvedTheme, ThemePreference } from './types';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PHONE_SELECTOR = '.device-screen';

function resolvePreference(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getPhoneContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(PHONE_SELECTOR);
}

function applyToPhone(resolved: ResolvedTheme): void {
  const el = getPhoneContainer();
  if (!el) return;
  el.setAttribute('data-theme', resolved);
  el.style.colorScheme = resolved;
}

function clearPhoneTheme(): void {
  const el = getPhoneContainer();
  if (!el) return;
  /* Phase A: leaving Profile restores light so Home stays unchanged. */
  el.setAttribute('data-theme', 'light');
  el.style.colorScheme = 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* SSR + first client render both use 'light' → no hydration mismatch. */
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  /* Read storage once before paint. */
  useLayoutEffect(() => {
    const stored = loadThemePreference();
    setPreferenceState(stored);
  }, []);

  /* Resolve, paint phone container, listen for OS changes when System. */
  useLayoutEffect(() => {
    const sync = () => {
      const next = resolvePreference(preference);
      setResolved(next);
      applyToPhone(next);
    };
    sync();

    if (preference !== 'system') return undefined;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [preference]);

  /* Restore light phone chrome when Profile (and this provider) unmounts. */
  useLayoutEffect(() => () => clearPhoneTheme(), []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    saveThemePreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="pf-theme-root" data-theme={resolved} style={{ colorScheme: resolved }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
