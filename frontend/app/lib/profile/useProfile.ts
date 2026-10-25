'use client';

import { useProfileContext, type ProfileContextValue, type ProfilePatch } from './ProfileContext';

export type { ProfileContextValue, ProfilePatch };

/**
 * Hook for Profile / Edit Profile screens.
 *
 * Shape:
 * ```
 * {
 *   profile: ProfileView | null;
 *   extras: ProfileExtras | null;
 *   status: 'loading' | 'ready';
 *   updateProfile(patch): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>;
 *   resetExtras(): void;
 *   setPhoto(file): Promise<…>;
 *   removePhoto(): void;
 * }
 * ```
 *
 * Phone and employer ID are read-only (session only). Name edits live in
 * localStorage extras and do **not** update `session.employer.name` — Home’s
 * “Namaste, …” still reads the session until a one-line wiring change is approved.
 *
 * Form error keys from `updateProfile` / `setPhoto`:
 * `fullName` | `email` | `dob` | `businessName` | `alternatePhone` | `photo` | `form`
 */
export function useProfile(): ProfileContextValue {
  return useProfileContext();
}
