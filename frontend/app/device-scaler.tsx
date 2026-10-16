'use client';

import { useEffect } from 'react';

const DEVICE_HEIGHT = 868; // .device height in globals.css
const DEVICE_WIDTH = 414;
const MARGIN = 48;

/** Scales the phone frame uniformly so the whole device fits the browser window. */
export function DeviceScaler() {
  useEffect(() => {
    const update = () => {
      const isPhone = window.innerWidth <= 500;
      const scale = isPhone
        ? 1
        : Math.min(1, (window.innerHeight - MARGIN) / DEVICE_HEIGHT, (window.innerWidth - MARGIN) / DEVICE_WIDTH);
      document.documentElement.style.setProperty('--device-scale', String(Math.max(scale, 0.4)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return null;
}
