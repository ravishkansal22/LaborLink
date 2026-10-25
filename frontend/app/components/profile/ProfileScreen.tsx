'use client';

/**
 * ProfileScreen entry – toggles Uber-style account layout vs the previous
 * card-based composition. Set USE_UBER_STYLE_PROFILE = false to revert instantly
 * (also see ProfileScreen.legacy.tsx for a full frozen copy).
 */

import { AccountProfileScreen } from './account';
import { ProfileScreenLegacy } from './ProfileScreen.legacy';
import type { Session, Language } from '../../lib/session';
import type { EmployerGo } from '../../screens/employer';

/** Flip to false to restore the pre–account-page Profile composition. */
const USE_UBER_STYLE_PROFILE = true;

interface ProfileScreenProps {
  session: Session;
  go: EmployerGo;
  onWorkerMode: () => void;
  onSignOut: () => void;
  onLanguage: (language: Language) => void;
}

export function ProfileScreen(props: ProfileScreenProps) {
  if (USE_UBER_STYLE_PROFILE) {
    return <AccountProfileScreen {...props} />;
  }
  return <ProfileScreenLegacy {...props} />;
}
