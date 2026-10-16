'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { ChevronsRight, Loader } from 'lucide-react';

/** Swipe-to-confirm button (thumb must be dragged most of the way). Enter/Space also confirm. */
export function SwipeButton({ label, onConfirm, busy = false, disabled = false }: { label: string; onConfirm: () => void; busy?: boolean; disabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; offset: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const THUMB = 52;

  const maxOffset = () => (track.current ? track.current.offsetWidth - THUMB - 8 : 0);
  // The phone frame may be CSS-zoomed: convert screen pixels into layout pixels.
  const scale = () => (track.current ? track.current.getBoundingClientRect().width / track.current.offsetWidth || 1 : 1);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, offset };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return;
    setOffset(Math.min(maxOffset(), Math.max(0, start.current.offset + (e.clientX - start.current.x) / scale())));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (offset >= maxOffset() * 0.85) { setOffset(maxOffset()); onConfirm(); } else setOffset(0);
  };

  return (
    <div ref={track} className={`swipe ${disabled ? 'disabled' : ''}`}>
      <span className="swipe-label" style={{ opacity: 1 - offset / Math.max(1, maxOffset()) }}>{busy ? 'Please wait…' : label}</span>
      <button type="button" className="swipe-thumb" aria-label={label} disabled={disabled || busy}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform .25s ease' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConfirm(); } }}>
        {busy ? <Loader size={20} className="spin" /> : <ChevronsRight size={22} />}
      </button>
    </div>
  );
}
