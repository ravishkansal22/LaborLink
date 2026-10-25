'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { EmployerProfile, Role } from '../session';
import { buildProfileView } from './buildProfileView';
import { resizeImageToDataUrl } from './image';
import { clearExtras, loadExtras, saveExtras } from './storage';
import type { ProfileExtras, ProfileStatus, ProfileUpdateResult, ProfileView } from './types';
import {
  validateBusinessName,
  validateDob,
  validateEmail,
  validateName,
  validatePhone,
} from './validation';

/** Fields editable via {@link ProfileContextValue.updateProfile} (local-only). */
export type ProfilePatch = {
  fullName?: string;
  email?: string;
  dob?: string;
  gender?: ProfileExtras['gender'];
  businessName?: string;
  alternatePhone?: string;
};

export interface ProfileContextValue {
  profile: ProfileView | null;
  /** Raw local extras (for Edit Profile forms). */
  extras: ProfileExtras | null;
  status: ProfileStatus;
  updateProfile: (patch: ProfilePatch) => Promise<ProfileUpdateResult>;
  resetExtras: () => void;
  setPhoto: (file: File) => Promise<ProfileUpdateResult>;
  removePhoto: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export interface ProfileProviderProps {
  children: ReactNode;
  /** Read-only session employer; never written by this provider. */
  employer: EmployerProfile | null;
  role: Role | null;
  /**
   * Whether a saved address exists. Pass from the location feature at the call site;
   * this module must not import `lib/location`.
   */
  hasAddress?: boolean;
  /** localStorage suffix; defaults to `employer.employerId`. */
  userKey?: string;
}

/**
 * Merges the session employer (read-only) with on-device profile extras.
 * Edits persist under `laborlink.profile.v1.<userKey>` only — not the session.
 */
export function ProfileProvider({
  children,
  employer,
  role,
  hasAddress = false,
  userKey: userKeyProp,
}: ProfileProviderProps) {
  const userKey = userKeyProp || employer?.employerId || '';
  const [extras, setExtras] = useState<ProfileExtras | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const prevUserKeyRef = useRef(userKey);

  useEffect(() => {
    const prev = prevUserKeyRef.current;
    // Safer shared-device default: when the signed-in user signs out (key → ''),
    // wipe that user's local extras so the next person on this phone cannot see them.
    // Different employerIds already use different keys (no cross-user read), but
    // leaving PII on disk after sign-out is still a leak on a shared phone.
    if (prev && !userKey) {
      clearExtras(prev);
    }
    prevUserKeyRef.current = userKey;

    if (!userKey) {
      setExtras(null);
      setStatus('ready');
      return;
    }
    setExtras(loadExtras(userKey));
    setStatus('ready');
  }, [userKey]);

  const persist = useCallback((next: ProfileExtras | null) => {
    if (!userKey) return;
    if (next) saveExtras(userKey, next);
    else clearExtras(userKey);
    setExtras(next);
  }, [userKey]);

  const updateProfile = useCallback(async (patch: ProfilePatch): Promise<ProfileUpdateResult> => {
    const errors: Record<string, string> = {};

    if (patch.fullName !== undefined) {
      const err = validateName(patch.fullName);
      if (err) errors.fullName = err;
    }
    if (patch.email !== undefined) {
      const err = validateEmail(patch.email);
      if (err) errors.email = err;
    }
    if (patch.dob !== undefined) {
      const err = validateDob(patch.dob);
      if (err) errors.dob = err;
    }
    if (patch.businessName !== undefined) {
      const err = validateBusinessName(patch.businessName);
      if (err) errors.businessName = err;
    }
    if (patch.alternatePhone !== undefined && patch.alternatePhone.trim()) {
      const err = validatePhone(patch.alternatePhone);
      if (err) errors.alternatePhone = err;
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const base: ProfileExtras = extras ?? { updatedAt: Date.now() };
    const next: ProfileExtras = {
      ...base,
      updatedAt: Date.now(),
    };

    if (patch.fullName !== undefined) next.fullName = patch.fullName.trim();
    if (patch.email !== undefined) {
      const v = patch.email.trim();
      if (v) next.email = v;
      else delete next.email;
    }
    if (patch.dob !== undefined) {
      const v = patch.dob.trim();
      if (v) next.dob = v;
      else delete next.dob;
    }
    if (patch.gender !== undefined) next.gender = patch.gender;
    if (patch.businessName !== undefined) {
      const v = patch.businessName.trim();
      if (v) next.businessName = v;
      else delete next.businessName;
    }
    if (patch.alternatePhone !== undefined) {
      const digits = patch.alternatePhone.replace(/\D/g, '');
      if (digits) next.alternatePhone = digits;
      else delete next.alternatePhone;
    }

    try {
      persist(next);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile.';
      return { ok: false, errors: { form: message } };
    }
  }, [extras, persist]);

  const resetExtras = useCallback(() => {
    persist(null);
  }, [persist]);

  const setPhoto = useCallback(async (file: File): Promise<ProfileUpdateResult> => {
    try {
      const photoDataUrl = await resizeImageToDataUrl(file);
      const base: ProfileExtras = extras ?? { updatedAt: Date.now() };
      const next: ProfileExtras = { ...base, photoDataUrl, updatedAt: Date.now() };
      persist(next);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save photo.';
      return { ok: false, errors: { photo: message } };
    }
  }, [extras, persist]);

  const removePhoto = useCallback(() => {
    if (!extras) return;
    const next: ProfileExtras = { ...extras, updatedAt: Date.now() };
    delete next.photoDataUrl;
    persist(next);
  }, [extras, persist]);

  const profile = useMemo(
    () => buildProfileView({ employer, role, extras, hasAddress }),
    [employer, role, extras, hasAddress],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, extras, status, updateProfile, resetExtras, setPhoto, removePhoto }),
    [profile, extras, status, updateProfile, resetExtras, setPhoto, removePhoto],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/**
 * Access the profile merge + local edit API. Must be under {@link ProfileProvider}.
 */
export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}
