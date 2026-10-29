'use client';

/**
 * Global Uber Theme Provider. Supports 'light', 'dark', and 'system' modes.
 * Applies `data-theme` + `color-scheme` to:
 * 1. The phone frame (`.device-screen`)
 * 2. `document.documentElement` (`<html>`)
 * Persists user preference via localStorage and listens for system preference changes.
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
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getPhoneContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(PHONE_SELECTOR);
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const phone = getPhoneContainer();
  if (phone) {
    phone.setAttribute('data-theme', resolved);
    phone.style.colorScheme = resolved;
  }
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [resolved, setResolved] = useState<ResolvedTheme>('dark');

  /* Read stored preference on mount */
  useLayoutEffect(() => {
    const stored = loadThemePreference();
    setPreferenceState(stored);
    const next = resolvePreference(stored);
    setResolved(next);
    applyTheme(next);
  }, []);

  /* Synchronize whenever preference changes or system theme changes */
  useLayoutEffect(() => {
    const sync = () => {
      const next = resolvePreference(preference);
      setResolved(next);
      applyTheme(next);
    };
    sync();

    if (preference !== 'system') return undefined;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    saveThemePreference(next);
    const resolvedNext = resolvePreference(next);
    setResolved(resolvedNext);
    applyTheme(resolvedNext);
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
