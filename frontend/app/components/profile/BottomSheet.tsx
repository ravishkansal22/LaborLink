'use client';

/**
 * ProfileBottomSheet – a bottom sheet that portals into #device-scroll
 * (the phone container), so it never spills outside the phone frame.
 *
 * Features:
 *  - Backdrop click / Escape key / close button → onClose()
 *  - Ref-counted scroll-lock on #device-scroll while open; cleaned up on close
 *  - Focus trap: first focusable child receives focus on open
 *  - Respects prefers-reduced-motion for the slide animation
 *  - Safe-area padding at the bottom (CSS env())
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { acquireScrollLock } from '../../lib/location/scrollLock';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** If true the drag handle is hidden (sheet is short / informational) */
  noHandle?: boolean;
}

export function ProfileBottomSheet({ open, onClose, title, children, noHandle }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  /* Ref-counted lock on #device-scroll (shared with LocationPicker) */
  useEffect(() => {
    if (!open) return undefined;
    return acquireScrollLock();
  }, [open]);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Auto-focus first focusable child */
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const el = sheetRef.current.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"]), input, select');
    el?.focus();
  }, [open]);

  if (!open) return null;

  // Portal target: the phone container
  const target = typeof document !== 'undefined' ? document.getElementById('device-scroll') : null;
  if (!target) return null;

  return createPortal(
    <div
      className="prof-sheet-overlay"
      aria-modal="true"
      role="dialog"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={sheetRef} className="prof-sheet">
        {!noHandle && <div className="sheet-handle" aria-hidden="true" />}
        <div className="prof-sheet-head">
          <span className="prof-sheet-title">{title}</span>
          <button
            type="button"
            className="prof-sheet-close icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="prof-sheet-body">{children}</div>
      </div>
    </div>,
    target,
  );
}
