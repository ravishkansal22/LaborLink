'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Search,
  X,
  Target,
  Plus,
  ChevronRight,
  AlertCircle,
  Loader2,
  MapPinOff,
} from 'lucide-react';
import { useLocation } from '../../lib/location/LocationContext';
import { searchPlaces } from '../../lib/location/geocode';
import { acquireScrollLock } from '../../lib/location/scrollLock';
import type { PlaceSuggestion, SavedAddress } from '../../lib/location/types';
import { SavedAddressCard } from './SavedAddressCard';
import { NearbyRow } from './NearbyRow';
import { AddAddressSheet } from './AddAddressSheet';

/** Exit slide duration — must match transition-transform duration below. */
const EXIT_MS = 250;

/**
 * Overlay z-index scale (phone container):
 *   content < bottom-nav (15) < picker (100) < sheets (600) < toasts (700)
 * Mount once via LocationProvider; screens only call openPicker()/closePicker().
 */

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
  onAdd?: () => void;
  onEdit?: (addressId: string) => void;
}

export function LocationPicker({
  open,
  onClose,
  onAdd,
}: LocationPickerProps) {
  const {
    selected,
    saved,
    current,
    nearby,
    status,
    refreshCurrent,
    selectSaved,
    selectPlace,
    removeAddress,
  } = useLocation();

  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  /** Keep in DOM during exit slide; unmount when fully closed (zero layout space). */
  const [present, setPresent] = useState(false);
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<SavedAddress | null>(null);
  const [, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Locate the phone screen container on mount (portal target = phone frame root)
  useEffect(() => {
    setMounted(true);
    const container =
      document.querySelector<HTMLElement>('.device-screen') ||
      document.getElementById('device-scroll') ||
      document.body;
    setPortalTarget(container);
  }, []);

  // Mounted/visible two-state: open → present+slide up; close → slide down then unmount
  useEffect(() => {
    if (open) {
      setPresent(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    setIsAddSheetOpen(false);
    setAddressToEdit(null);
    const timer = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Ref-counted lock on #device-scroll while picker is showing
  useEffect(() => {
    if (!visible) return undefined;
    return acquireScrollLock();
  }, [visible]);

  // Handle escape key
  useEffect(() => {
    if (!visible) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Focus search input when opened
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
    setSearchQuery('');
    setSearchResults([]);
  }, [visible]);

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(q, current?.coords, controller.signal)
        .then((results) => {
          startTransition(() => {
            setSearchResults(results);
            setIsSearching(false);
          });
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, current?.coords]);

  const handleUseCurrentLocation = async () => {
    if (status === 'denied') {
      await refreshCurrent();
      return;
    }
    if (current) {
      selectPlace({
        id: 'current-loc',
        title: 'Current Location',
        subtitle: current.addressLine,
        lat: current.coords.lat,
        lng: current.coords.lng,
      });
      onClose();
    } else {
      await refreshCurrent();
    }
  };

  // Closed = fully unmounted (preferred): zero layout space, no flow contribution
  if (!mounted || !portalTarget || !present) return null;

  const content = (
    <>
      <div
        className={`absolute inset-0 z-[100] flex flex-col bg-[var(--loc-bg)] text-[var(--loc-text)] transition-transform duration-[250ms] ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Select a location"
      aria-hidden={!visible}
      ref={(node) => {
        if (!node) return;
        if (!visible) node.setAttribute('inert', '');
        else node.removeAttribute('inert');
      }}
    >
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-2 px-4 pt-12 pb-3 bg-white border-b border-slate-100 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)]"
          aria-label="Close location picker"
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
        </button>

        <h2 className="font-semibold text-[20px] text-[var(--loc-text)] tracking-tight">
          Select a location
        </h2>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 overscroll-contain">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-[var(--loc-green)]">
            <Search size={18} strokeWidth={2.5} />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for area, street name…"
            className="w-full h-12 pl-10 pr-10 bg-white rounded-2xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-[var(--loc-muted)] focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 shadow-sm transition-all"
            aria-label="Search address"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-3 flex items-center justify-center text-slate-400 hover:text-slate-600 focus-visible:outline-none"
              aria-label="Clear search text"
            >
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                <X size={13} strokeWidth={2.5} />
              </div>
            </button>
          )}
        </div>

        {/* Dynamic Content: Search Results vs Location Sections */}
        {searchQuery.trim() ? (
          /* Search Results List */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {isSearching ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-[var(--loc-muted)]">
                <Loader2 size={24} className="animate-spin text-[var(--loc-green)]" />
                <p className="text-xs font-medium">Searching nearby locations…</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <MapPinOff size={22} />
                </div>
                <h4 className="font-semibold text-sm text-slate-800 mt-1">No locations found</h4>
                <p className="text-xs text-[var(--loc-muted)] max-w-[220px]">
                  Try searching with a different locality, landmark or pin code
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.map((item, idx) => (
                  <NearbyRow
                    key={item.id}
                    place={item}
                    currentCoords={current?.coords}
                    showDivider={idx < searchResults.length - 1}
                    onSelect={(place) => {
                      selectPlace(place);
                      onClose();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Card 1: Action Rows (Use Current Location & Add Address) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] divide-y divide-slate-100 overflow-hidden">
              {/* Row 1: Use Current Location */}
              <div className="p-3.5 transition-colors hover:bg-slate-50/70">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleUseCurrentLocation}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleUseCurrentLocation();
                    }
                  }}
                  className="flex items-start gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] rounded-xl"
                  aria-label="Use current location"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--loc-green-soft)] flex items-center justify-center shrink-0 text-[var(--loc-green)] mt-0.5">
                    {status === 'loading' ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Target size={20} strokeWidth={2.4} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[15px] text-[var(--loc-green)] tracking-tight">
                        Use current location
                      </span>
                      <ChevronRight size={18} className="text-slate-400 shrink-0" />
                    </div>

                    <p className="text-xs text-[var(--loc-muted)] line-clamp-2 leading-relaxed mt-0.5">
                      {status === 'loading'
                        ? 'Fetching your current GPS position…'
                        : current?.addressLine ?? 'Tap to detect your current location'}
                    </p>
                  </div>
                </div>

                {/* Inline Denied Warning */}
                {status === 'denied' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-amber-700 bg-amber-50/70 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle size={16} className="shrink-0" />
                      <span className="text-xs font-medium truncate">
                        Location permission is denied
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={refreshCurrent}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--loc-green)] text-white hover:bg-[var(--loc-green)]/90 shrink-0 shadow-sm"
                    >
                      Enable location
                    </button>
                  </div>
                )}
              </div>

              {/* Row 2: Add Address */}
              <button
                type="button"
                onClick={() => {
                  setAddressToEdit(null);
                  setIsAddSheetOpen(true);
                  if (onAdd) {
                    onAdd();
                  }
                }}
                className="w-full flex items-center justify-between p-3.5 text-left transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)]"
                aria-label="Add new address"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--loc-green-soft)] flex items-center justify-center shrink-0 text-[var(--loc-green)]">
                    <Plus size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="font-semibold text-[15px] text-slate-800 tracking-tight block">
                      Add Address
                    </span>
                    <span className="text-xs text-[var(--loc-muted)]">
                      Save a new home, work or other address
                    </span>
                  </div>
                </div>

                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </button>
            </div>

            {/* SAVED ADDRESSES SECTION */}
            {saved.length > 0 && (
              <section className="space-y-2.5" aria-labelledby="saved-addresses-heading">
                <h3
                  id="saved-addresses-heading"
                  className="text-[12px] font-semibold tracking-widest uppercase text-[var(--loc-muted)] px-1"
                >
                  SAVED ADDRESSES
                </h3>

                <div className="space-y-3">
                  {saved.map((addr) => {
                    const isSelected = selected ? 'id' in selected && selected.id === addr.id : false;
                    return (
                      <SavedAddressCard
                        key={addr.id}
                        address={addr}
                        isSelected={isSelected}
                        currentCoords={current?.coords}
                        onSelect={() => {
                          selectSaved(addr.id);
                          onClose();
                        }}
                        onEdit={(address) => {
                          setAddressToEdit(address);
                          setIsAddSheetOpen(true);
                        }}
                        onDelete={(id) => removeAddress(id)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* NEARBY LOCATIONS SECTION */}
            {nearby.length > 0 && (
              <section className="space-y-2.5 pt-1" aria-labelledby="nearby-locations-heading">
                <h3
                  id="nearby-locations-heading"
                  className="text-[12px] font-semibold tracking-widest uppercase text-[var(--loc-muted)] px-1"
                >
                  NEARBY LOCATIONS
                </h3>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] divide-y divide-slate-100 overflow-hidden">
                  {nearby.map((place, idx) => (
                    <NearbyRow
                      key={place.id}
                      place={place}
                      currentCoords={current?.coords}
                      showDivider={idx < nearby.length - 1}
                      onSelect={(p) => {
                        selectPlace(p);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>

    <AddAddressSheet
        open={isAddSheetOpen}
        onClose={() => {
          setIsAddSheetOpen(false);
          setAddressToEdit(null);
        }}
        addressToEdit={addressToEdit}
        onChangeLocation={() => {
          setIsAddSheetOpen(false);
          setAddressToEdit(null);
          searchInputRef.current?.focus();
        }}
        onSuccess={() => {
          setIsAddSheetOpen(false);
          setAddressToEdit(null);
          onClose();
        }}
      />
    </>
  );

  return createPortal(content, portalTarget);
}
