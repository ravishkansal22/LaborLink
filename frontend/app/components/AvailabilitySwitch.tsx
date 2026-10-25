'use client';

/**
 * Shared availability pill switch (Home, Find Work, Worker Profile).
 * Visible track matches legacy .toggle (46×28, 22px thumb); 44×44 hit area
 * via transparent padding — does not stretch the painted track.
 */

import './availability-switch.css';

export function AvailabilitySwitch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`avail-switch ${on ? 'on' : ''}`}
      onClick={onChange}
    >
      <span className="avail-switch-track" aria-hidden="true">
        <span className="avail-switch-thumb" />
      </span>
    </button>
  );
}
