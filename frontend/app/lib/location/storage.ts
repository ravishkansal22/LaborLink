import type { SavedAddress } from './types';

const ADDRESSES_KEY = 'laborlink.addresses.v1';
const SELECTED_KEY = 'laborlink.selected.v1';

function isSavedAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.line1 === 'string' &&
    typeof v.area === 'string' &&
    typeof v.city === 'string' &&
    typeof v.lat === 'number' &&
    typeof v.lng === 'number' &&
    typeof v.createdAt === 'number'
  );
}

/**
 * Loads saved addresses from localStorage.
 * Returns [] on SSR, missing key, or corrupt JSON.
 */
export function loadAddresses(): SavedAddress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedAddress);
  } catch {
    return [];
  }
}

/**
 * Persists the address list under the versioned key `laborlink.addresses.v1`.
 */
export function saveAddresses(list: SavedAddress[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota / private-mode failures
  }
}

/**
 * Loads the selected address id, or null when unset / SSR / storage errors.
 */
export function loadSelectedId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the selected address id (or clears it when null).
 */
export function saveSelectedId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(SELECTED_KEY, id);
    } else {
      localStorage.removeItem(SELECTED_KEY);
    }
  } catch {
    // Ignore quota / private-mode failures
  }
}
