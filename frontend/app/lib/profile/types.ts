/**
 * Local-only profile fields stored on-device (not synced to the backend).
 * Phone and employer ID stay on the session and are never stored here.
 */
export interface ProfileExtras {
  fullName?: string;
  email?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not';
  photoDataUrl?: string;
  businessName?: string;
  alternatePhone?: string;
  updatedAt: number;
}

/** Merged view of session employer + local extras for Profile / Edit Profile UI. */
export interface ProfileView {
  fullName: string;
  initials: string;
  role: 'Employer' | 'Worker';
  phone: string;
  maskedPhone: string;
  email?: string;
  photoDataUrl?: string;
  employerId: string;
  verified: boolean;
  completionPercent: number;
  missingFields: string[];
}

/** Result of {@link computeCompletion}. */
export interface CompletionResult {
  percent: number;
  missingFields: string[];
}

export type ProfileStatus = 'loading' | 'ready';

export type ProfileUpdateResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

/** Thrown when a photo data URL exceeds the on-device storage cap. */
export class PhotoTooLargeError extends Error {
  readonly code = 'PHOTO_TOO_LARGE' as const;

  constructor(message = 'Photo is too large to save on this phone (max ~300 KB).') {
    super(message);
    this.name = 'PhotoTooLargeError';
  }
}
