'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentCoords, LocationPermissionDeniedError } from './geolocation';
import { reverseGeocode } from './geocode';
import { nearbyPlaces } from './nearbyPlaces';
import { loadAddresses, loadSelectedId, saveAddresses, saveSelectedId } from './storage';
import type { Coords, LocationStatus, PlaceSuggestion, SavedAddress } from './types';

export interface CurrentLocationInfo {
  coords: Coords;
  addressLine: string;
}

export interface LocationContextValue {
  selected: SavedAddress | PlaceSuggestion | null;
  saved: SavedAddress[];
  current: CurrentLocationInfo | null;
  nearby: PlaceSuggestion[];
  status: LocationStatus;
  refreshCurrent: () => Promise<void>;
  selectSaved: (id: string) => void;
  selectPlace: (place: PlaceSuggestion) => void;
  addAddress: (data: Omit<SavedAddress, 'id' | 'createdAt'>) => SavedAddress;
  updateAddress: (id: string, patch: Partial<SavedAddress>) => void;
  removeAddress: (id: string) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Provides saved addresses, current GPS position, nearby places, and selection state.
 * On mount loads storage then calls `refreshCurrent()` without blocking first paint.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [current, setCurrent] = useState<CurrentLocationInfo | null>(null);
  const [nearby, setNearby] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(loadAddresses());
    setSelectedId(loadSelectedId());
    setHydrated(true);
  }, []);

  const refreshCurrent = useCallback(async () => {
    setStatus('loading');
    try {
      const coords = await getCurrentCoords();
      const addressLine = await reverseGeocode(coords);
      setCurrent({ coords, addressLine });
      setStatus('ready');
      const places = await nearbyPlaces(coords);
      setNearby(places);
    } catch (err: unknown) {
      if (err instanceof LocationPermissionDeniedError) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshCurrent();
  }, [hydrated, refreshCurrent]);

  const selectSaved = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedPlace(null);
    saveSelectedId(id);
  }, []);

  const selectPlace = useCallback((place: PlaceSuggestion) => {
    setSelectedPlace(place);
    setSelectedId(null);
    saveSelectedId(null);
  }, []);

  const addAddress = useCallback(
    (data: Omit<SavedAddress, 'id' | 'createdAt'>): SavedAddress => {
      const newAddr: SavedAddress = {
        ...data,
        id: `addr-${Date.now()}`,
        createdAt: Date.now(),
      };
      setSaved((prev) => {
        const updated = [newAddr, ...prev];
        saveAddresses(updated);
        return updated;
      });
      selectSaved(newAddr.id);
      return newAddr;
    },
    [selectSaved],
  );

  const updateAddress = useCallback((id: string, patch: Partial<SavedAddress>) => {
    setSaved((prev) => {
      const updated = prev.map((addr) => (addr.id === id ? { ...addr, ...patch } : addr));
      saveAddresses(updated);
      return updated;
    });
  }, []);

  const removeAddress = useCallback((id: string) => {
    setSaved((prev) => {
      const updated = prev.filter((addr) => addr.id !== id);
      saveAddresses(updated);
      return updated;
    });
    setSelectedId((prev) => {
      if (prev !== id) return prev;
      saveSelectedId(null);
      return null;
    });
  }, []);

  // selected: saved id → else chosen place → else current GPS → else null
  const selected = useMemo((): SavedAddress | PlaceSuggestion | null => {
    if (selectedId) {
      const found = saved.find((s) => s.id === selectedId);
      if (found) return found;
    }
    if (selectedPlace) return selectedPlace;
    if (current) {
      const title = current.addressLine.split(',')[0]?.trim() || 'Current Location';
      return {
        id: 'current-pos',
        title,
        subtitle: current.addressLine,
        lat: current.coords.lat,
        lng: current.coords.lng,
      };
    }
    return null;
  }, [selectedId, saved, selectedPlace, current]);

  const value = useMemo<LocationContextValue>(
    () => ({
      selected,
      saved,
      current,
      nearby,
      status,
      refreshCurrent,
      selectSaved,
      selectPlace,
      addAddress,
      updateAddress,
      removeAddress,
    }),
    [
      selected,
      saved,
      current,
      nearby,
      status,
      refreshCurrent,
      selectSaved,
      selectPlace,
      addAddress,
      updateAddress,
      removeAddress,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/**
 * Hook into {@link LocationProvider}. Throws if used outside the provider.
 */
export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
