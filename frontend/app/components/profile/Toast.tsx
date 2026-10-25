'use client';

/**
 * ProfileToast – a small toast notification scoped to the phone frame.
 * Portals into #device-scroll and auto-dismisses after `duration` ms.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface ToastProps {
  message: string;
  /** Auto-dismiss after this many ms. Default 3000. */
  duration?: number;
  onDismiss: () => void;
}

export function ProfileToast({ message, duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 200); }, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  const target = typeof document !== 'undefined' ? document.getElementById('device-scroll') : null;
  if (!target) return null;

  return createPortal(
    <div
      className={`prof-toast ${visible ? 'prof-toast-in' : 'prof-toast-out'}`}
      role="status"
      aria-live="polite"
    >
      <Info size={16} />
      <span>{message}</span>
    </div>,
    target,
  );
}

/** Simple hook to imperatively show a toast. */
export function useProfileToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (message: string) => setMsg(message);
  const dismiss = () => setMsg(null);
  const element = msg ? <ProfileToast message={msg} onDismiss={dismiss} /> : null;
  return { show, element };
}
