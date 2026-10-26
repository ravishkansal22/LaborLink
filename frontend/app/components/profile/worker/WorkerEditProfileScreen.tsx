'use client';

/**
 * Worker Edit Profile — local-only extras under `worker-<id>`.
 * Composes AppBar + theme tokens + lib/profile validators/image helpers
 * (Employer Edit Profile is still a stub; this is the worker composition).
 *
 * yearsExperience in extras is display-only; the Profile trade line uses
 * backend `years_experience` (not overwritten by Save).
 */

import { useEffect, useRef, useState } from 'react';
import { Copy, Lock } from 'lucide-react';
import { AppBar } from '../../ui';
import { ConfirmActionSheet } from './ConfirmActionSheet';
import { useProfileToast } from '../Toast';
import {
  getInitials,
  maskPhone,
  PhotoTooLargeError,
  resizeImageToDataUrl,
  validateAboutYou,
  validateDob,
  validateEmail,
  validateName,
  validatePhone,
  validateYearsExperience,
  type ProfileExtras,
} from '../../../lib/profile';
import { t } from '../../../lib/i18n';
import './worker-profile.css';

type Gender = NonNullable<ProfileExtras['gender']>;

interface WorkerEditProfileScreenProps {
  workerId: string;
  displayName: string;
  phoneDigits: string;
  extras: ProfileExtras | null;
  backendYears: number | null;
  focusField?: string;
  onBack: () => void;
  onPersist: (next: ProfileExtras | null) => void;
  onResetExtras: () => void;
}

interface FormState {
  fullName: string;
  email: string;
  alternatePhone: string;
  dob: string;
  gender: Gender | '';
  yearsExperience: string;
  aboutYou: string;
  photoDataUrl?: string;
}

function extrasToForm(
  extras: ProfileExtras | null,
  displayName: string,
  backendYears: number | null,
): FormState {
  return {
    fullName: extras?.fullName?.trim() || displayName,
    email: extras?.email ?? '',
    alternatePhone: extras?.alternatePhone ?? '',
    dob: extras?.dob ?? '',
    gender: extras?.gender ?? '',
    yearsExperience:
      extras?.yearsExperience != null
        ? String(extras.yearsExperience)
        : backendYears != null
          ? String(backendYears)
          : '',
    aboutYou: extras?.aboutYou ?? '',
    photoDataUrl: extras?.photoDataUrl,
  };
}

export function WorkerEditProfileScreen({
  workerId,
  displayName,
  phoneDigits,
  extras,
  backendYears,
  focusField,
  onBack,
  onPersist,
  onResetExtras,
}: WorkerEditProfileScreenProps) {
  const { show, element: toastEl } = useProfileToast();
  const [form, setForm] = useState<FormState>(() =>
    extrasToForm(extras, displayName, backendYears),
  );
  const [baseline, setBaseline] = useState<FormState>(() =>
    extrasToForm(extras, displayName, backendYears),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const yearsRef = useRef<HTMLInputElement>(null);
  const aboutRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const next = extrasToForm(extras, displayName, backendYears);
    setForm(next);
    setBaseline(next);
  }, [extras, displayName, backendYears]);

  useEffect(() => {
    const map: Record<string, HTMLElement | null> = {
      name: nameRef.current,
      email: emailRef.current,
      dob: dobRef.current,
      yearsExperience: yearsRef.current,
      aboutYou: aboutRef.current,
      photo: galleryRef.current,
      phone: nameRef.current,
    };
    const el = focusField ? map[focusField] : nameRef.current;
    el?.focus();
  }, [focusField]);

  const dirty =
    form.fullName !== baseline.fullName
    || form.email !== baseline.email
    || form.alternatePhone !== baseline.alternatePhone
    || form.dob !== baseline.dob
    || form.gender !== baseline.gender
    || form.yearsExperience !== baseline.yearsExperience
    || form.aboutYou !== baseline.aboutYou
    || form.photoDataUrl !== baseline.photoDataUrl;

  const requestBack = () => {
    if (dirty) setDiscardOpen(true);
    else onBack();
  };

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const photoDataUrl = await resizeImageToDataUrl(file);
      patch('photoDataUrl', photoDataUrl);
      setErrors((e) => {
        const next = { ...e };
        delete next.photo;
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Could not save photo.');
      setErrors((e) => ({ ...e, photo: message }));
    }
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    const nameErr = validateName(form.fullName);
    if (nameErr) nextErrors.fullName = nameErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) nextErrors.email = emailErr;
    if (form.alternatePhone.trim()) {
      const altErr = validatePhone(form.alternatePhone);
      if (altErr) nextErrors.alternatePhone = altErr;
    }
    const dobErr = validateDob(form.dob);
    if (dobErr) nextErrors.dob = dobErr;
    const yearsErr = validateYearsExperience(form.yearsExperience);
    if (yearsErr) nextErrors.yearsExperience = yearsErr;
    const aboutErr = validateAboutYou(form.aboutYou);
    if (aboutErr) nextErrors.aboutYou = aboutErr;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const next: ProfileExtras = {
        ...(extras ?? { updatedAt: Date.now() }),
        updatedAt: Date.now(),
        fullName: form.fullName.trim(),
      };
      if (phoneDigits) next.phone = phoneDigits;

      const email = form.email.trim();
      if (email) next.email = email;
      else delete next.email;

      const altDigits = form.alternatePhone.replace(/\D/g, '');
      if (altDigits) next.alternatePhone = altDigits;
      else delete next.alternatePhone;

      const dob = form.dob.trim();
      if (dob) next.dob = dob;
      else delete next.dob;

      if (form.gender) next.gender = form.gender;
      else delete next.gender;

      if (form.yearsExperience.trim() !== '') {
        next.yearsExperience = Number(form.yearsExperience);
      } else {
        delete next.yearsExperience;
      }

      if (form.aboutYou) next.aboutYou = form.aboutYou;
      else delete next.aboutYou;

      if (form.photoDataUrl) next.photoDataUrl = form.photoDataUrl;
      else delete next.photoDataUrl;

      onPersist(next);
      setBaseline({ ...form });
      show(t('Profile updated'));
      onBack();
    } catch (err) {
      if (err instanceof PhotoTooLargeError) {
        setErrors((e) => ({ ...e, photo: t('Could not save photo.') }));
      } else {
        show(t('Could not save profile.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(form.fullName || displayName);
  const shortId = workerId.slice(0, 8);
  const lockedPhone = phoneDigits
    ? maskPhone(`+91 ${phoneDigits}`)
    : t('Not saved on this phone');

  const genders: { id: Gender; label: string }[] = [
    { id: 'male', label: t('Male') },
    { id: 'female', label: t('Female') },
    { id: 'other', label: t('Other') },
    { id: 'prefer_not', label: t('Prefer not to say') },
  ];

  return (
    <main className="screen acct">
      {toastEl}
      <AppBar title={t('Edit Profile')} onBack={requestBack} />
      <div className="wp-edit">
        <div className="wp-edit-photo">
          <div className="wp-edit-avatar" aria-hidden="true">
            {form.photoDataUrl ? (
              <img src={form.photoDataUrl} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="wp-edit-photo-actions">
            <button type="button" onClick={() => galleryRef.current?.click()}>
              {t('Gallery')}
            </button>
            <button type="button" onClick={() => cameraRef.current?.click()}>
              {t('Camera')}
            </button>
            {form.photoDataUrl ? (
              <button type="button" onClick={() => patch('photoDataUrl', undefined)}>
                {t('Remove')}
              </button>
            ) : null}
          </div>
          {errors.photo ? <p className="wp-edit-error">{errors.photo}</p> : null}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="wp-sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              void onPickPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            className="wp-sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              void onPickPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-name">{t('Full name')}</label>
          <input
            id="wp-edit-name"
            ref={nameRef}
            value={form.fullName}
            maxLength={60}
            autoComplete="name"
            onChange={(e) => patch('fullName', e.target.value)}
          />
          {errors.fullName ? <p className="wp-edit-error">{errors.fullName}</p> : null}
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-phone">{t('Phone')}</label>
          <div className="wp-phone-lock">
            <input
              id="wp-edit-phone"
              className="pf-readonly"
              value={lockedPhone}
              disabled
              readOnly
              aria-readonly="true"
            />
            <Lock size={16} className="lock" aria-hidden="true" />
          </div>
          <p className="wp-edit-hint">{t('Phone cannot be changed here.')}</p>
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-id">{t('Worker ID')}</label>
          <div className="wp-id-row">
            <input
              id="wp-edit-id"
              className="pf-readonly"
              value={shortId}
              disabled
              readOnly
              aria-readonly="true"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(workerId).then(
                  () => show(t('Copied')),
                  () => show(t('Could not copy')),
                );
              }}
            >
              <Copy size={14} aria-hidden="true" /> {t('Copy')}
            </button>
          </div>
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-email">{t('Email')}</label>
          <input
            id="wp-edit-email"
            ref={emailRef}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => patch('email', e.target.value)}
          />
          {errors.email ? <p className="wp-edit-error">{errors.email}</p> : null}
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-alt">{t('Alternate phone')}</label>
          <div className="phone-field">
            <span className="country">+91</span>
            <input
              id="wp-edit-alt"
              inputMode="numeric"
              autoComplete="tel-national"
              value={form.alternatePhone}
              onChange={(e) =>
                patch('alternatePhone', e.target.value.replace(/\D/g, '').slice(0, 10))
              }
            />
          </div>
          {errors.alternatePhone ? (
            <p className="wp-edit-error">{errors.alternatePhone}</p>
          ) : null}
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-dob">{t('Date of birth')}</label>
          <input
            id="wp-edit-dob"
            ref={dobRef}
            type="date"
            value={form.dob}
            onChange={(e) => patch('dob', e.target.value)}
          />
          {errors.dob ? <p className="wp-edit-error">{errors.dob}</p> : null}
        </div>

        <div className="wp-edit-field">
          <span id="wp-edit-gender-label">{t('Gender')}</span>
          <div
            className="wp-gender-row"
            role="radiogroup"
            aria-labelledby="wp-edit-gender-label"
          >
            {genders.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={form.gender === g.id}
                className={form.gender === g.id ? 'on' : ''}
                onClick={() => patch('gender', g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-years">{t('Years of experience')}</label>
          <input
            id="wp-edit-years"
            ref={yearsRef}
            inputMode="numeric"
            value={form.yearsExperience}
            onChange={(e) =>
              patch('yearsExperience', e.target.value.replace(/[^\d]/g, '').slice(0, 2))
            }
          />
          <p className="wp-edit-hint">
            {t('Saved on this phone only. Your public profile still uses the experience from your work profile.')}
          </p>
          {errors.yearsExperience ? (
            <p className="wp-edit-error">{errors.yearsExperience}</p>
          ) : null}
        </div>

        <div className="wp-edit-field">
          <label htmlFor="wp-edit-about">{t('About you')}</label>
          <textarea
            id="wp-edit-about"
            ref={aboutRef}
            maxLength={200}
            value={form.aboutYou}
            onChange={(e) => patch('aboutYou', e.target.value.slice(0, 200))}
          />
          <p className="wp-edit-counter">{form.aboutYou.length}/200</p>
          {errors.aboutYou ? <p className="wp-edit-error">{errors.aboutYou}</p> : null}
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            onResetExtras();
            const cleared = extrasToForm(null, displayName, backendYears);
            setForm(cleared);
            setBaseline(cleared);
            show(t('Local extras cleared'));
          }}
        >
          {t('Reset local extras')}
        </button>

        <div className="wp-edit-sticky">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !dirty}
            onClick={() => void save()}
          >
            {t('Save changes')}
          </button>
        </div>
      </div>

      <ConfirmActionSheet
        open={discardOpen}
        title={t('Discard changes?')}
        body={t('Your edits will be lost.')}
        confirmLabel={t('Discard')}
        danger
        onClose={() => setDiscardOpen(false)}
        onConfirm={onBack}
      />
    </main>
  );
}
