import type { CompletionResult, ProfileExtras } from './types';

export interface CompletionBase {
  /** Display name already present (session or extras). */
  hasName: boolean;
  /** Login / primary phone present. */
  hasPhone: boolean;
  /** Saved address exists — pass from caller; do not import location here. */
  hasAddress: boolean;
}

const WEIGHTS = {
  name: 20,
  phone: 20,
  address: 20,
  email: 15,
  photo: 10,
  dob: 5,
  gender: 5,
  businessName: 5,
} as const;

/**
 * Weighted profile-completion percent and human-readable missing field labels.
 * Pure: pass `hasAddress` in; does not touch location storage.
 */
export function computeCompletion(base: CompletionBase, extras: ProfileExtras | null): CompletionResult {
  const e = extras ?? { updatedAt: 0 };
  let earned = 0;
  const missingFields: string[] = [];

  if (base.hasName || Boolean(e.fullName?.trim())) {
    earned += WEIGHTS.name;
  } else {
    missingFields.push('Full name');
  }

  if (base.hasPhone) {
    earned += WEIGHTS.phone;
  } else {
    missingFields.push('Phone');
  }

  if (base.hasAddress) {
    earned += WEIGHTS.address;
  } else {
    missingFields.push('Saved address');
  }

  if (e.email?.trim()) {
    earned += WEIGHTS.email;
  } else {
    missingFields.push('Email');
  }

  if (e.photoDataUrl?.trim()) {
    earned += WEIGHTS.photo;
  } else {
    missingFields.push('Photo');
  }

  if (e.dob?.trim()) {
    earned += WEIGHTS.dob;
  } else {
    missingFields.push('Date of birth');
  }

  if (e.gender) {
    earned += WEIGHTS.gender;
  } else {
    missingFields.push('Gender');
  }

  if (e.businessName?.trim()) {
    earned += WEIGHTS.businessName;
  } else {
    missingFields.push('Business name');
  }

  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const percent = Math.round((earned / total) * 100);
  return { percent, missingFields };
}
