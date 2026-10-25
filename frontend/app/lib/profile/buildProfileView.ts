import { computeCompletion } from './completion';
import { getInitials } from './initials';
import { maskPhone } from './mask';
import type { EmployerProfile, Role } from '../session';
import type { ProfileExtras, ProfileView } from './types';

export interface BuildProfileInput {
  employer: EmployerProfile | null;
  role: Role | null;
  extras: ProfileExtras | null;
  hasAddress: boolean;
}

/**
 * Merges session employer (read-only) with local extras into a {@link ProfileView}.
 * Phone and employerId always come from the session employer.
 */
export function buildProfileView(input: BuildProfileInput): ProfileView | null {
  const { employer, role, extras, hasAddress } = input;
  if (!employer) return null;

  const fullName = (extras?.fullName?.trim() || employer.name || '').trim() || '—';
  const phoneDigits = employer.phone.replace(/\D/g, '');
  const phoneDisplay = phoneDigits ? `+91 ${phoneDigits}` : employer.phone;
  const completion = computeCompletion(
    {
      hasName: Boolean(fullName && fullName !== '—'),
      hasPhone: phoneDigits.length === 10,
      hasAddress,
    },
    extras,
  );

  return {
    fullName,
    initials: getInitials(fullName === '—' ? '' : fullName),
    role: role === 'worker' ? 'Worker' : 'Employer',
    phone: phoneDisplay,
    maskedPhone: maskPhone(phoneDisplay),
    email: extras?.email?.trim() || undefined,
    photoDataUrl: extras?.photoDataUrl,
    employerId: employer.employerId,
    verified: false,
    completionPercent: completion.percent,
    missingFields: completion.missingFields,
  };
}
