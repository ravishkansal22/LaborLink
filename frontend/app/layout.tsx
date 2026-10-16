import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Mukta } from 'next/font/google';
import { BatteryFull, Signal, Wifi } from 'lucide-react';
import { DeviceScaler } from './device-scaler';
import './globals.css';

// Mukta is designed for Devanagari and Latin together, so Hindi and English text match.
const mukta = Mukta({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-mukta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LaborLink',
  description: 'Find skilled workers nearby and pay a fair price.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf8ff',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={mukta.variable}>
      <body>
        <DeviceScaler />
        {/* On wide screens the app is shown inside a phone frame; on real phones it fills the screen. */}
        <div className="stage">
          <div className="device">
            <div className="device-screen">
              <div className="status-bar" aria-hidden="true">
                <span className="status-time">9:41</span>
                <span className="dynamic-island" />
                <span className="status-icons">
                  <Signal size={16} strokeWidth={2.5} />
                  <Wifi size={16} strokeWidth={2.5} />
                  <BatteryFull size={22} strokeWidth={2} />
                </span>
              </div>
              <div className="device-scroll" id="device-scroll">
                {children}
              </div>
              <div className="home-indicator" aria-hidden="true" />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
