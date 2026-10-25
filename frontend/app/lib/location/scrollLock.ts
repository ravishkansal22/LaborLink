/**
 * Ref-counted scroll lock for phone overlays (picker, sheets, etc.).
 * Locks `#device-scroll` — the element that actually scrolls inside the frame.
 * Restores the previous inline overflow when the last lock releases.
 */

let lockCount = 0;
let previousOverflow = '';
let lockedEl: HTMLElement | null = null;

/** Acquire a lock; returns a release function (safe to call more than once). */
export function acquireScrollLock(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const el = document.getElementById('device-scroll');
  if (!el) return () => undefined;

  if (lockCount === 0) {
    lockedEl = el;
    previousOverflow = el.style.overflow;
    el.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0 && lockedEl) {
      lockedEl.style.overflow = previousOverflow;
      lockedEl = null;
      previousOverflow = '';
    }
  };
}
