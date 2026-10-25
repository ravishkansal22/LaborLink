'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { t } from '../../lib/i18n';
import styles from './SortMenu.module.css';

export type JobSortId = 'nearest' | 'newest' | 'highest_pay';

const OPTIONS: Array<{ id: JobSortId; label: string }> = [
  { id: 'nearest', label: 'Nearest' },
  { id: 'newest', label: 'Newest' },
  { id: 'highest_pay', label: 'Highest pay' },
];

interface SortMenuProps {
  value: JobSortId;
  onChange: (id: JobSortId) => void;
}

export function SortMenu({ value, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t(current.label)}
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label={t('Sort jobs')}>
          {OPTIONS.map((opt) => (
            <li key={opt.id} role="option" aria-selected={opt.id === value}>
              <button
                type="button"
                className={`${styles.option} ${opt.id === value ? styles.optionOn : ''}`}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                {t(opt.label)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
