'use client';

/**
 * ProfileScreen – NEW profile screen composing all sub-components.
 *
 * Receives the same props as the old EmployerProfileScreen (session, go,
 * onWorkerMode, onSignOut, onLanguage) so page.tsx needs a one-line swap.
 *
 * Preserved behaviours (rule 5):
 *  (a) language switching → onLanguage called through LanguageSheet
 *  (b) "Switch to worker mode" → onWorkerMode (existing handler)
 *  (c) "Jobs posted" count = session.jobIds.length, navigation = go.jobs
 *  (d) "Sign out of this phone" red button → onSignOut (existing handler)
 *  (e) Employer ID display at bottom
 *  (f) name/phone/role from session.employer
 *
 * onOpenEdit → shows the Edit Profile stub (full-screen, in-stack via useState).
 */

import { useState } from 'react';
import { useProfile, maskPhone, computeCompletion } from './__mocks__';
import { ProfileHeader } from './ProfileHeader';
import { ProfileUserCard } from './ProfileUserCard';
import { ProfileCompletion } from './ProfileCompletion';
import { VerifyBanner } from './VerifyBanner';
import { SettingsList } from './SettingsList';
import { WorkerModeCard } from './WorkerModeCard';
import { JobsPostedCard } from './JobsPostedCard';
import { SignOutFooter } from './SignOutFooter';
import { EditProfileStub } from './EditProfileStub';
import type { Session, Language } from '../../lib/session';
import type { EmployerGo } from '../../screens/employer';
import { BottomNav } from '../ui';
import { BriefcaseBusiness, House, UserRound } from 'lucide-react';
import { t } from '../../lib/i18n';

interface ProfileScreenProps {
  session: Session;
  go: EmployerGo;
  onWorkerMode: () => void;
  onSignOut: () => void;
  onLanguage: (language: Language) => void;
}

type EditState = { open: false } | { open: true; focusField?: string };

export function ProfileScreen({
  session,
  go,
  onWorkerMode,
  onSignOut,
  onLanguage,
}: ProfileScreenProps) {
  const { profile } = useProfile(session);
  const [edit, setEdit] = useState<EditState>({ open: false });

  const openEdit = (focusField?: string) => setEdit({ open: true, focusField });
  const closeEdit = () => setEdit({ open: false });

  // While Edit Profile is open, render it full-screen (same visual layer)
  if (edit.open) {
    return (
      <EditProfileStub
        focusField={edit.focusField}
        onBack={closeEdit}
      />
    );
  }

  if (!profile) {
    // Should not happen in employer context – fall back gracefully
    return (
      <main className="screen has-nav">
        <p className="small muted">{t('No profile data.')}</p>
      </main>
    );
  }

  const pct = computeCompletion(profile);
  const maskedPh = maskPhone(profile.phone);

  return (
    <main className="screen has-nav">
      {/* Order matches design spec */}
      <div className="prof-content">

        {/* 1. Header: wordmark + gear + "Profile" h1 */}
        <ProfileHeader onOpenEdit={openEdit} />

        {/* 2. User card */}
        <ProfileUserCard
          profile={profile}
          maskedPhone={maskedPh}
          onOpenEdit={openEdit}
        />

        {/* 3. Completion bar */}
        <ProfileCompletion pct={pct} onOpenEdit={() => openEdit()} />

        {/* 4. Verify banner (hidden when verified) */}
        <VerifyBanner verified={profile.verified} />

        {/* 5. Settings list */}
        <SettingsList
          language={session.language}
          onLanguage={onLanguage}
          onOpenEdit={openEdit}
          savedAddressValue={profile.address || undefined}
        />

        {/* 6. Worker mode card */}
        <WorkerModeCard onWorkerMode={onWorkerMode} />

        {/* 7. Jobs posted card */}
        <JobsPostedCard
          count={session.jobIds.length}
          onNavigate={go.jobs}
        />

        {/* 8. Sign out + Employer ID */}
        <SignOutFooter
          onSignOut={onSignOut}
          employerId={profile.employerId}
        />
      </div>

      {/* Bottom navigation – identical to old EmployerProfileScreen */}
      <BottomNav items={[
        { label: 'Home', icon: <House size={22} />, active: false, onClick: go.home },
        { label: 'My jobs', icon: <BriefcaseBusiness size={22} />, active: false, onClick: go.jobs },
        { label: 'Profile', icon: <UserRound size={22} />, active: true, onClick: go.profile },
      ]} />
    </main>
  );
}
