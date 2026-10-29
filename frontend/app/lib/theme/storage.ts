import type { ThemePreference } from './types';

export const THEME_STORAGE_KEY = 'laborlink.theme.v1';

const DEFAULT_PREFERENCE: ThemePreference = 'dark';

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Loads the stored theme preference. SSR-safe; defaults to `'light'`
 * so existing users see no change until they pick Appearance.
 */
export function loadThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCE;
  try {
    const storage = window.localStorage;
    if (!storage) return DEFAULT_PREFERENCE;
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    const parsed: unknown = JSON.parse(raw);
    if (isThemePreference(parsed)) return parsed;
    // Plain string writes
    if (isThemePreference(raw)) return raw;
    return DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** Persists preference. No-ops on SSR / private mode failures. */
export function saveThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    if (!storage) return;
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    /* private mode / quota — keep in-memory only */
  }
}
