'use client';

import { useEffect, useState } from 'react';

/** Current time for the phone-frame status bar. */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="status-time">{now ? now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false }) : ''}</span>;
}
