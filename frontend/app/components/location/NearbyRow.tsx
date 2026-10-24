'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import type { PlaceSuggestion, Coords } from '../../lib/location/types';
import { haversineMeters, formatDistance } from '../../lib/location/distance';

interface NearbyRowProps {
  place: PlaceSuggestion;
  currentCoords?: Coords | null;
  onSelect: (place: PlaceSuggestion) => void;
  showDivider?: boolean;
}

export function NearbyRow({
  place,
  currentCoords,
  onSelect,
  showDivider = true,
}: NearbyRowProps) {
  const distanceText = currentCoords
    ? formatDistance(haversineMeters(currentCoords, { lat: place.lat, lng: place.lng }))
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(place)}
      className={`w-full flex items-start gap-3.5 py-3.5 px-3 text-left rounded-xl transition-colors hover:bg-white active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] ${
        showDivider ? 'border-b border-slate-100/80' : ''
      }`}
      aria-label={`${place.title}, ${place.subtitle}. Tap to select this location`}
    >
      {/* Icon & Distance */}
      <div className="flex flex-col items-center shrink-0 w-9 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
          <MapPin size={16} strokeWidth={2.2} />
        </div>
        {distanceText && (
          <span className="text-[10px] font-semibold text-[var(--loc-muted)] tracking-tight text-center mt-1 whitespace-nowrap">
            {distanceText}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-[14px] leading-tight text-[var(--loc-text)] tracking-tight truncate">
          {place.title}
        </h4>
        <p className="text-xs text-[var(--loc-muted)] truncate leading-normal mt-1">
          {place.subtitle}
        </p>
      </div>
    </button>
  );
}
