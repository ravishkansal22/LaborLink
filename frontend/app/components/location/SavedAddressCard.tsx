'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Home, Briefcase, MapPin, MoreVertical, Check, Trash2, Edit3 } from 'lucide-react';
import type { SavedAddress, Coords } from '../../lib/location/types';
import { haversineMeters, formatDistance } from '../../lib/location/distance';

interface SavedAddressCardProps {
  address: SavedAddress;
  isSelected: boolean;
  currentCoords?: Coords | null;
  onSelect: () => void;
  onEdit?: (address: SavedAddress) => void;
  onDelete?: (id: string) => void;
}

export function SavedAddressCard({
  address,
  isSelected,
  currentCoords,
  onSelect,
  onEdit,
  onDelete,
}: SavedAddressCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Compute distance from current coordinates
  const distanceText = currentCoords
    ? formatDistance(haversineMeters(currentCoords, { lat: address.lat, lng: address.lng }))
    : null;

  const getLabelIcon = () => {
    switch (address.label) {
      case 'Home':
        return <Home size={18} strokeWidth={2} />;
      case 'Work':
        return <Briefcase size={18} strokeWidth={2} />;
      default:
        return <MapPin size={18} strokeWidth={2} />;
    }
  };

  const fullAddress = [
    address.line1,
    address.landmark ? `Near ${address.landmark}` : null,
    address.area,
    address.city,
    address.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative bg-white rounded-2xl p-4 transition-all border text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
        isSelected
          ? 'border-[var(--loc-green)] ring-1 ring-[var(--loc-green)]'
          : 'border-slate-100 hover:border-slate-200'
      }`}
      aria-label={`${address.label} address: ${fullAddress}. ${isSelected ? 'Currently selected' : 'Tap to select'}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Left Column: Icon Tile + Distance */}
        <div className="flex flex-col items-center shrink-0 w-11">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-[var(--loc-green-soft)] text-[var(--loc-green)]'
                : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200/70'
            }`}
          >
            {getLabelIcon()}
          </div>
          {distanceText && (
            <span className="text-[11px] font-semibold text-[var(--loc-muted)] tracking-tight text-center mt-1.5 whitespace-nowrap">
              {distanceText}
            </span>
          )}
        </div>

        {/* Right Column: Address Details */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[15px] text-[var(--loc-text)] tracking-tight">
              {address.label}
            </span>

            {isSelected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--loc-green-soft)] text-[var(--loc-green)]">
                <Check size={11} strokeWidth={3} />
                Selected
              </span>
            )}
          </div>

          <p className="text-[13px] text-[var(--loc-muted)] line-clamp-2 leading-snug mt-1">
            {fullAddress}
          </p>

          {address.phone && (
            <p className="text-xs text-[var(--loc-muted)] font-medium mt-1.5">
              Phone number: <span className="text-slate-800">{address.phone}</span>
            </p>
          )}

          {/* Action Row: 36px circular outlined icon buttons */}
          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100/80">
            <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((prev) => !prev);
                  setConfirmDelete(false);
                }}
                className="w-9 h-9 rounded-full border border-slate-200/90 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)]"
                aria-label="Address options"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 bottom-10 z-20 w-44 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5 text-sm animate-in fade-in zoom-in-95 duration-150"
                  role="menu"
                >
                  {confirmDelete ? (
                    <div className="p-2 space-y-2 text-center">
                      <p className="text-xs font-semibold text-slate-700">Delete this address?</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete?.(address.id);
                            setMenuOpen(false);
                          }}
                          className="flex-1 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onEdit(address);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors text-left"
                          role="menuitem"
                        >
                          <Edit3 size={15} className="text-slate-500" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium transition-colors text-left"
                        role="menuitem"
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
