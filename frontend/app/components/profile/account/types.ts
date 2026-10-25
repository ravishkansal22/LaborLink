import type { LucideIcon } from 'lucide-react';

/** Config-driven account list row. */
export interface AccountRowConfig {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Optional small pill (e.g. "NEW"); omit by default — do not invent promos. */
  badge?: string;
  /** Subtle chevron when the row opens a real sub-screen. */
  showChevron?: boolean;
}
