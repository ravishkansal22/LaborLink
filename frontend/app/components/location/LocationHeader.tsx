'use client';

import React from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLocation } from '../../lib/location/LocationContext';
import type { SavedAddress, PlaceSuggestion } from '../../lib/location/types';

interface LocationHeaderProps {
  onClick: () => void;
  className?: string;
}

function isSavedAddress(item: SavedAddress | PlaceSuggestion): item is SavedAddress {
  return 'label' in item;
}

export function LocationHeader({ onClick, className = '' }: LocationHeaderProps) {
  const { selected, status } = useLocation();

  if (status === 'loading' && !selected) {
    return (
      <div
        className={`flex items-center gap-2.5 min-h-[44px] py-1 text-left flex-1 min-w-0 animate-pulse ${className}`}
        aria-busy="true"
        aria-label="Loading location"
      >
        <div className="w-5 h-5 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="w-20 h-4 bg-slate-200 rounded" />
          <div className="w-40 h-3 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  let title = 'Set your location';
  let subtitle = 'Select delivery or service address…';

  if (selected) {
    if (isSavedAddress(selected)) {
      title = selected.label;
      const parts = [selected.line1, selected.area, selected.city].filter(Boolean);
      subtitle = parts.join(', ');
    } else {
      title = selected.title;
      subtitle = selected.subtitle || 'Selected location';
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2.5 min-h-[44px] py-1 px-1 -mx-1 text-left flex-1 min-w-0 rounded-xl transition-colors hover:bg-black/5 active:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] ${className}`}
      aria-label={`Location: ${title}, ${subtitle}. Tap to change location`}
    >
      <div className="w-8 h-8 rounded-full bg-[var(--loc-green-soft)] flex items-center justify-center shrink-0 text-[var(--loc-green)]">
        <MapPin size={18} strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-bold text-[15px] leading-tight text-[var(--loc-text)] tracking-tight truncate">
            {title}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.2}
            className="text-[var(--loc-muted)] shrink-0 transition-transform group-hover:translate-y-0.5"
          />
        </div>
        <p className="text-xs text-[var(--loc-muted)] truncate leading-normal mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
