'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check, Phone, ShieldCheck, User, Mail, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Session } from '../../lib/session';
import { t } from '../../lib/i18n';

interface EditProfileProps {
  session?: Session;
  focusField?: string;
  onBack: () => void;
  onUpdated?: (updatedName: string, updatedEmail?: string) => void;
}

export function EditProfileStub({ session, focusField, onBack, onUpdated }: EditProfileProps) {
  const currentName = session?.employer?.name || '';
  const currentPhone = session?.employer?.phone || '';
  const userId = session?.userId || session?.employer?.employerId || '';

  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);

    try {
      if (userId) {
        await api.updateUser(userId, {
          name: trimmed,
          email: email.trim() || undefined,
        });
      }

      // Persist to session storage
      try {
        const raw = localStorage.getItem('laborlink.session.v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.employer) {
            parsed.employer.name = trimmed;
          }
          localStorage.setItem('laborlink.session.v1', JSON.stringify(parsed));
        }
      } catch {
        // Fallback for sandboxed environments
      }

      setSaved(true);
      onUpdated?.(trimmed, email.trim() || undefined);
      setTimeout(() => {
        onBack();
      }, 400);
    } catch (err: any) {
      setError(err?.message || t('Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="screen has-nav acct" style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'var(--pf-surface-2, rgba(255,255,255,0.08))',
            border: '1px solid var(--pf-border, rgba(255,255,255,0.1))',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pf-text, inherit)',
            cursor: 'pointer',
          }}
          aria-label={t('Back')}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--pf-text)' }}>
          {t('Edit Profile')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--pf-muted)' }}>
            {t('Full Name')}
          </label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--pf-muted)' }} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={focusField === 'name'}
              required
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                borderRadius: '12px',
                border: '1px solid var(--pf-border)',
                background: 'var(--pf-surface)',
                color: 'var(--pf-text)',
                fontSize: '1rem',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--pf-muted)' }}>
            {t('Phone Number')}
          </label>
          <div style={{ position: 'relative' }}>
            <Phone size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--pf-muted)' }} />
            <input
              type="text"
              value={`+91 ${currentPhone}`}
              disabled
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                borderRadius: '12px',
                border: '1px solid var(--pf-border)',
                background: 'var(--pf-surface-2)',
                color: 'var(--pf-muted)',
                fontSize: '1rem',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: '12px',
                top: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                color: '#22c55e',
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={14} /> {t('Verified')}
            </span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--pf-muted)' }}>
            {t('Email Address')}
          </label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--pf-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={focusField === 'email'}
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                borderRadius: '12px',
                border: '1px solid var(--pf-border)',
                background: 'var(--pf-surface)',
                color: 'var(--pf-text)',
                fontSize: '1rem',
              }}
            />
          </div>
        </div>

        {error ? (
          <p style={{ color: 'var(--pf-danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={{
            marginTop: '12px',
            padding: '14px',
            borderRadius: '12px',
            background: saved ? '#22c55e' : 'var(--pf-brand)',
            border: 'none',
            color: 'var(--pf-on-brand, #ffffff)',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {saving ? (
            <><Loader2 size={18} className="spin" /> {t('Saving...')}</>
          ) : saved ? (
            <><Check size={18} /> {t('Saved!')}</>
          ) : (
            t('Save changes')
          )}
        </button>
      </form>
    </main>
  );
}