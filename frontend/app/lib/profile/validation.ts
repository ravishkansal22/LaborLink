const NAME_RE = /^[\p{L}\p{M}\s.'-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

/**
 * Validates a display name (2–60 chars; letters, spaces, Devanagari, . ' -).
 * @returns Error message, or `null` if valid.
 */
export function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 60) return 'Name must be at most 60 characters.';
  if (!NAME_RE.test(trimmed)) {
    return 'Name can only include letters, spaces, and . \' -';
  }
  return null;
}

/**
 * Optional email check (RFC-lite). Empty string is valid.
 * @returns Error message, or `null` if valid / empty.
 */
export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 120) return 'Email is too long.';
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

/**
 * 10-digit Indian mobile starting with 6–9 (digits only, no country code).
 * @returns Error message, or `null` if valid.
 */
export function validatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!PHONE_RE.test(digits)) {
    return 'Enter a 10-digit Indian mobile number starting with 6–9.';
  }
  return null;
}

/**
 * Optional date of birth (`YYYY-MM-DD`). Not in the future; age ≥ 14.
 * @returns Error message, or `null` if valid / empty.
 */
export function validateDob(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return 'Use date format YYYY-MM-DD.';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(year, month - 1, day);
  if (
    Number.isNaN(dob.getTime())
    || dob.getFullYear() !== year
    || dob.getMonth() !== month - 1
    || dob.getDate() !== day
  ) {
    return 'Enter a real date of birth.';
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (dob > todayStart) return 'Date of birth cannot be in the future.';

  const age = ageInYears(dob, todayStart);
  if (age < 14) return 'You must be at least 14 years old.';
  return null;
}

/**
 * Optional business / shop name, max 80 characters.
 * @returns Error message, or `null` if valid / empty.
 */
export function validateBusinessName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) return 'Business name must be at most 80 characters.';
  return null;
}

/**
 * Optional worker "About you" blurb, max 200 characters.
 * @returns Error message, or `null` if valid / empty.
 */
export function validateAboutYou(value: string): string | null {
  if (value.length > 200) return 'About you must be at most 200 characters.';
  return null;
}

/**
 * Optional years of experience 0–60 (local extras; backend may also store years).
 * Empty string is valid. @returns Error message, or `null` if valid / empty.
 */
export function validateYearsExperience(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Enter a whole number of years.';
  if (n < 0 || n > 60) return 'Years of experience must be between 0 and 60.';
  return null;
}

function ageInYears(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}
