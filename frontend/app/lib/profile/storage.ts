import { PhotoTooLargeError, type ProfileExtras } from './types';

const KEY_PREFIX = 'laborlink.profile.v1.';
/** Soft cap for persisted photo data URLs (~300 KB of string length). */
export const MAX_PHOTO_DATA_URL_CHARS = 300 * 1024;

/**
 * Builds the versioned localStorage key for one user.
 * @param userKey Stable id — prefer role-scoped ids so extras never collide:
 *   employer `emp-9911050007`, worker `worker-<workerId>`.
 */
export function extrasKey(userKey: string): string {
  return `${KEY_PREFIX}${userKey}`;
}

/**
 * Loads local profile extras for `userKey`.
 * Returns `null` on SSR, missing key, or corrupt JSON.
 */
export function loadExtras(userKey: string): ProfileExtras | null {
  if (typeof window === 'undefined') return null;
  if (!userKey) return null;
  try {
    const raw = window.localStorage.getItem(extrasKey(userKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseExtras(parsed);
  } catch {
    return null;
  }
}

/**
 * Persists extras for `userKey`. Rejects oversized photo data URLs.
 * @throws {PhotoTooLargeError} when `photoDataUrl` exceeds {@link MAX_PHOTO_DATA_URL_CHARS}.
 */
export function saveExtras(userKey: string, extras: ProfileExtras): void {
  if (typeof window === 'undefined') return;
  if (!userKey) return;

  if (extras.photoDataUrl && extras.photoDataUrl.length > MAX_PHOTO_DATA_URL_CHARS) {
    throw new PhotoTooLargeError();
  }

  try {
    window.localStorage.setItem(extrasKey(userKey), JSON.stringify(extras));
  } catch {
    // private mode / quota: ignore
  }
}

/** Removes local extras for `userKey`. */
export function clearExtras(userKey: string): void {
  if (typeof window === 'undefined') return;
  if (!userKey) return;
  try {
    window.localStorage.removeItem(extrasKey(userKey));
  } catch {
    // ignore
  }
}

/**
 * Removes every `laborlink.profile.v1.*` entry on this device.
 * Safer shared-phone default for sign-out — call from the sign-out path
 * (or rely on {@link ProfileProvider}, which clears the previous userKey
 * when it becomes empty).
 */
export function clearAllExtras(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key);
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function parseExtras(value: unknown): ProfileExtras | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.updatedAt !== 'number' || !Number.isFinite(v.updatedAt)) return null;

  const gender = v.gender;
  const okGender =
    gender === undefined
    || gender === 'male'
    || gender === 'female'
    || gender === 'other'
    || gender === 'prefer_not';
  if (!okGender) return null;

  const extras: ProfileExtras = { updatedAt: v.updatedAt };
  if (typeof v.fullName === 'string') extras.fullName = v.fullName;
  if (typeof v.email === 'string') extras.email = v.email;
  if (typeof v.dob === 'string') extras.dob = v.dob;
  if (gender === 'male' || gender === 'female' || gender === 'other' || gender === 'prefer_not') {
    extras.gender = gender;
  }
  if (typeof v.photoDataUrl === 'string') extras.photoDataUrl = v.photoDataUrl;
  if (typeof v.businessName === 'string') extras.businessName = v.businessName;
  if (typeof v.alternatePhone === 'string') extras.alternatePhone = v.alternatePhone;
  if (typeof v.phone === 'string') extras.phone = v.phone;
  if (typeof v.yearsExperience === 'number' && Number.isFinite(v.yearsExperience)) {
    extras.yearsExperience = v.yearsExperience;
  }
  if (typeof v.aboutYou === 'string') extras.aboutYou = v.aboutYou;
  return extras;
}
