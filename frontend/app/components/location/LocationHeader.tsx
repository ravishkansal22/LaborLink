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
        <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="w-20 h-4 bg-neutral-800 rounded" />
          <div className="w-40 h-3 bg-neutral-800 rounded" />
        </div>
      </div>
    );
  }

  let title = 'RZ Road';
  let subtitle = 'West Sagarpur, Delhi';

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
      className={`group flex items-center gap-2.5 min-h-[44px] py-1 px-1 -mx-1 text-left flex-1 min-w-0 rounded-xl transition-colors hover:bg-white/5 active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${className}`}
      aria-label={`Location: ${title}, ${subtitle}. Tap to change location`}
    >
      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 text-black">
        <MapPin size={17} strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-bold text-[15px] leading-tight text-white tracking-tight truncate">
            {title}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.2}
            className="text-neutral-400 shrink-0 transition-transform group-hover:translate-y-0.5"
          />
        </div>
        <p className="text-xs text-neutral-400 truncate leading-normal mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
