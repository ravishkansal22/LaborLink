'use client';

import { Bell, BriefcaseBusiness, CheckCircle2, IndianRupee } from 'lucide-react';
import { ProfileBottomSheet } from './BottomSheet';
import { t } from '../../lib/i18n';

interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
  onViewJobs?: () => void;
  onViewPassbook?: () => void;
}

interface NotificationItem {
  id: string;
  type: 'job' | 'booking' | 'payment';
  title: string;
  detail: string;
  time: string;
  unread?: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    type: 'job',
    title: 'New job near your trade',
    detail: 'Plumber needed for kitchen pipe repair • RZ Road (1.4 km away) • ₹450/hr',
    time: '10m ago',
    unread: true,
  },
  {
    id: 'n-2',
    type: 'booking',
    title: 'Booking confirmed!',
    detail: 'Employer Rahul accepted your offer for Masonry work today at 3:30 PM.',
    time: '2h ago',
    unread: true,
  },
  {
    id: 'n-3',
    type: 'payment',
    title: 'Payment credited to Passbook',
    detail: '₹850 received for Job #LNK-4029. Verified by employer.',
    time: 'Yesterday',
    unread: false,
  },
];

export function NotificationsSheet({ open, onClose, onViewJobs, onViewPassbook }: NotificationsSheetProps) {
  return (
    <ProfileBottomSheet open={open} onClose={onClose} title={t('Notifications')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        {MOCK_NOTIFICATIONS.map((item) => {
          const Icon = item.type === 'job' ? BriefcaseBusiness : item.type === 'booking' ? CheckCircle2 : IndianRupee;
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px',
                borderRadius: 14,
                border: '1px solid var(--line)',
                background: item.unread ? 'var(--surface-2)' : 'var(--surface)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</strong>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>{item.time}</span>
                </div>
                <p style={{ fontSize: 13, marginTop: 4, lineHeight: 1.4, opacity: 0.85 }}>{item.detail}</p>
                {item.type === 'job' && onViewJobs && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewJobs();
                    }}
                    style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View jobs →
                  </button>
                )}
                {item.type === 'payment' && onViewPassbook && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewPassbook();
                    }}
                    style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open passbook →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ProfileBottomSheet>
  );
}
