'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

/* ------------------------------------------------------------------ types */

export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface SavedAddress {
  id: string;
  label: AddressLabel;
  line1: string;
  area: string;
  city: string;
  pincode?: string;
  landmark?: string;
  receiverName?: string;
  phone?: string;
  lat: number;
  lng: number;
  createdAt: number;
}

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

export interface LocationContextValue {
  selected: SavedAddress | PlaceSuggestion | null;
  saved: SavedAddress[];
  current: { coords: Coords; addressLine: string } | null;
  nearby: PlaceSuggestion[];
  status: LocationStatus;
  refreshCurrent: () => Promise<void>;
  selectSaved: (id: string) => void;
  selectPlace: (place: PlaceSuggestion) => void;
  addAddress: (data: Omit<SavedAddress, 'id' | 'createdAt'>) => SavedAddress;
  updateAddress: (id: string, patch: Partial<SavedAddress>) => void;
  removeAddress: (id: string) => void;
}

/* ------------------------------------------------------------------ distance */

/** Computes distance between two coordinates in meters using the Haversine formula. */
export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

/** Formats meters into human-readable strings like "0 m", "10 m", "850 m", "1.2 km". */
export function formatDistance(meters: number): string {
  if (meters < 10) return `${Math.max(0, Math.round(meters))} m`;
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/* ------------------------------------------------------------------ geolocation & geocoding */

const DEFAULT_COORDS: Coords = { lat: 28.7041, lng: 77.1025 }; // Rohini, Delhi

export async function getCurrentCoords(): Promise<Coords> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return DEFAULT_COORDS;
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export async function reverseGeocode(coords: Coords): Promise<string> {
  // Mock reverse geocode based on proximity or Delhi coordinates
  if (Math.abs(coords.lat - 28.7041) < 0.05 && Math.abs(coords.lng - 77.1025) < 0.05) {
    return 'Sector 9, Rohini, New Delhi, Delhi 110085';
  }
  if (Math.abs(coords.lat - 28.6315) < 0.05 && Math.abs(coords.lng - 77.2167) < 0.05) {
    return 'Connaught Place, New Delhi, Delhi 110001';
  }
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}, New Delhi, Delhi`;
}

const SAMPLE_PLACES: PlaceSuggestion[] = [
  { id: 'place-1', title: 'Rohini Sector 9', subtitle: 'North West Delhi, Delhi', lat: 28.7041, lng: 77.1025 },
  { id: 'place-2', title: 'Rohini West Metro Station', subtitle: 'Sector 10, Rohini, Delhi', lat: 28.7145, lng: 77.1132 },
  { id: 'place-3', title: 'Unity One Mall', subtitle: 'Near Rohini West Metro, Sector 10, Rohini, Delhi', lat: 28.7138, lng: 77.1140 },
  { id: 'place-4', title: 'DC Chowk Market', subtitle: 'Sector 9, Rohini, Delhi', lat: 28.7072, lng: 77.1198 },
  { id: 'place-5', title: 'Japanese Park (Swarna Jayanti)', subtitle: 'Sector 10, Rohini, Delhi', lat: 28.7196, lng: 77.1171 },
  { id: 'place-6', title: 'Connaught Place', subtitle: 'Central Delhi, New Delhi', lat: 28.6315, lng: 77.2167 },
  { id: 'place-7', title: 'Karol Bagh', subtitle: 'Central Delhi, New Delhi', lat: 28.6514, lng: 77.1907 },
  { id: 'place-8', title: 'Pitampura', subtitle: 'North West Delhi, Delhi', lat: 28.6990, lng: 77.1384 },
];

export async function searchPlaces(q: string, bias?: Coords, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  void bias;
  void signal;
  const query = q.trim().toLowerCase();
  if (!query) return [];
  await new Promise((res) => setTimeout(res, 180));
  return SAMPLE_PLACES.filter(
    (p) => p.title.toLowerCase().includes(query) || p.subtitle.toLowerCase().includes(query),
  );
}

export async function nearbyPlaces(coords: Coords): Promise<PlaceSuggestion[]> {
  void coords;
  await new Promise((res) => setTimeout(res, 100));
  return SAMPLE_PLACES.slice(1, 5);
}

/* ------------------------------------------------------------------ storage */

const STORAGE_KEY_ADDRESSES = 'laborlink_saved_addresses_v1';
const STORAGE_KEY_SELECTED = 'laborlink_selected_address_id_v1';

const INITIAL_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr-1',
    label: 'Home',
    line1: 'Flat 402, Block B, Rohini Heights',
    area: 'Sector 9, Rohini',
    city: 'New Delhi',
    pincode: '110085',
    landmark: 'Near DC Chowk',
    receiverName: 'Atharv',
    phone: '+91 98765 43210',
    lat: 28.7041,
    lng: 77.1025,
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'addr-2',
    label: 'Work',
    line1: 'Unit 3A, Inner Circle, Connaught Place',
    area: 'Connaught Place',
    city: 'New Delhi',
    pincode: '110001',
    landmark: 'Near Rajiv Chowk Metro Gate 4',
    receiverName: 'Atharv',
    phone: '+91 98765 43210',
    lat: 28.6315,
    lng: 77.2167,
    createdAt: Date.now() - 86400000,
  },
];

export function loadAddresses(): SavedAddress[] {
  if (typeof window === 'undefined') return INITIAL_ADDRESSES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADDRESSES);
    return raw ? JSON.parse(raw) : INITIAL_ADDRESSES;
  } catch {
    return INITIAL_ADDRESSES;
  }
}

export function saveAddresses(list: SavedAddress[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ADDRESSES, JSON.stringify(list));
  } catch {
    // Ignore storage quota
  }
}

export function loadSelectedId(): string | null {
  if (typeof window === 'undefined') return 'addr-1';
  try {
    return localStorage.getItem(STORAGE_KEY_SELECTED) ?? 'addr-1';
  } catch {
    return 'addr-1';
  }
}

export function saveSelectedId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_SELECTED, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_SELECTED);
    }
  } catch {
    // Ignore storage quota
  }
}

/* ------------------------------------------------------------------ Context & Provider */

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<SavedAddress[]>(() => loadAddresses());
  const [selectedId, setSelectedId] = useState<string | null>(() => loadSelectedId());
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [current, setCurrent] = useState<{ coords: Coords; addressLine: string } | null>({
    coords: DEFAULT_COORDS,
    addressLine: 'Sector 9, Rohini, New Delhi, Delhi 110085',
  });
  const [nearby, setNearby] = useState<PlaceSuggestion[]>(SAMPLE_PLACES.slice(1, 5));
  const [status, setStatus] = useState<LocationStatus>('ready');

  // Sync saved addresses to localStorage
  useEffect(() => {
    saveAddresses(saved);
  }, [saved]);

  // Sync selectedId to localStorage
  useEffect(() => {
    saveSelectedId(selectedId);
  }, [selectedId]);

  const refreshCurrent = useCallback(async () => {
    setStatus('loading');
    try {
      const coords = await getCurrentCoords();
      const addressLine = await reverseGeocode(coords);
      setCurrent({ coords, addressLine });
      const nearbyList = await nearbyPlaces(coords);
      setNearby(nearbyList);
      setStatus('ready');
    } catch (err: unknown) {
      const ge = err as GeolocationPositionError;
      if (ge?.code === 1 /* PERMISSION_DENIED */) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
    }
  }, []);

  const selectSaved = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedPlace(null);
  }, []);

  const selectPlace = useCallback((place: PlaceSuggestion) => {
    setSelectedPlace(place);
    setSelectedId(null);
  }, []);

  const addAddress = useCallback((data: Omit<SavedAddress, 'id' | 'createdAt'>): SavedAddress => {
    const newAddress: SavedAddress = {
      ...data,
      id: `addr-${Date.now()}`,
      createdAt: Date.now(),
    };
    setSaved((prev) => [newAddress, ...prev]);
    setSelectedId(newAddress.id);
    setSelectedPlace(null);
    return newAddress;
  }, []);

  const updateAddress = useCallback((id: string, patch: Partial<SavedAddress>) => {
    setSaved((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeAddress = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next;
    });
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const selected = useMemo(() => {
    if (selectedPlace) return selectedPlace;
    if (selectedId) {
      const found = saved.find((item) => item.id === selectedId);
      if (found) return found;
    }
    return saved[0] ?? null;
  }, [selectedId, selectedPlace, saved]);

  const value: LocationContextValue = useMemo(
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

  return React.createElement(LocationContext.Provider, { value }, children);
}

const defaultLocationValue: LocationContextValue = {
  selected: INITIAL_ADDRESSES[0],
  saved: INITIAL_ADDRESSES,
  current: { coords: DEFAULT_COORDS, addressLine: 'Sector 9, Rohini, New Delhi, Delhi 110085' },
  nearby: SAMPLE_PLACES.slice(1, 5),
  status: 'ready',
  refreshCurrent: async () => {},
  selectSaved: () => {},
  selectPlace: () => {},
  addAddress: (data) => ({ ...data, id: 'addr-mock', createdAt: Date.now() }),
  updateAddress: () => {},
  removeAddress: () => {},
};

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  return ctx ?? defaultLocationValue;
}
