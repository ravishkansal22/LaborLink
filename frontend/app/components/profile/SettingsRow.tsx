'use client';

/**
 * SettingsRow – a single row in the profile settings list.
 *
 * Layout: [40px icon tile] [label] [optional right value] [chevron]
 * Press state: active:scale-[0.98] via CSS class
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';

interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  value?: string;
  onClick: () => void;
  /** Used for accessibility */
  id?: string;
}

export function SettingsRow({ Icon, label, value, onClick, id }: SettingsRowProps) {
  return (
    <button
      id={id}
      type="button"
      className="prof-settings-row"
      onClick={onClick}
    >
      <span className="tile-icon prof-tile-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <span className="grow prof-row-label">{label}</span>
      {value !== undefined && (
        <span className="prof-row-value">{value}</span>
      )}
      <ChevronRight size={18} className="muted" aria-hidden="true" />
    </button>
  );
}
