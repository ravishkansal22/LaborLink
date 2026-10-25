import type { Coords, PlaceSuggestion } from './types';

/** Optional backend switch; only this module needs to change for Google/Mapbox later. */
type GeocoderBackend = 'photon' | 'nominatim' | 'google' | 'mapbox';

const INDIA_BBOX = '68.1,6.5,97.4,35.7'; // minLon,minLat,maxLon,maxLat
const SEARCH_LIMIT = 8;

const searchCache = new Map<string, PlaceSuggestion[]>();
const reverseCache = new Map<string, string>();

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    district?: string;
    locality?: string;
    suburb?: string;
  };
}

interface NominatimSearchHit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

/**
 * Returns the configured geocoder backend from `NEXT_PUBLIC_GEOCODER` (default: photon).
 * Google / Mapbox are reserved for a future paid key; callers should not branch on this.
 */
export function getGeocoderBackend(): GeocoderBackend {
  const raw = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEOCODER : undefined)
    ?.trim()
    .toLowerCase();
  if (raw === 'nominatim' || raw === 'google' || raw === 'mapbox' || raw === 'photon') {
    return raw;
  }
  return 'photon';
}

/**
 * Debounces `fn` by `delayMs` (default 300). Returns a void wrapper; trailing call wins.
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs = 300,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function isIndiaFeature(p: PhotonFeature['properties']): boolean {
  const code = (p.countrycode ?? '').toLowerCase();
  if (code === 'in') return true;
  const country = (p.country ?? '').toLowerCase();
  return country === 'india' || country.includes('भारत');
}

function mapPhotonFeature(feat: PhotonFeature, idx: number, idPrefix: string): PlaceSuggestion {
  const p = feat.properties;
  const title =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(' ') ||
    p.locality ||
    p.suburb ||
    p.district ||
    'Unknown location';
  const subtitleParts = [
    p.name ? p.street : undefined,
    p.district || p.suburb || p.locality,
    p.city,
    p.state,
    p.postcode,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(', ') || p.country || 'India';
  const [lng, lat] = feat.geometry.coordinates;
  return {
    id: `${idPrefix}-${idx}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    title,
    subtitle,
    lat,
    lng,
  };
}

function indiaFirstPhoton(features: PhotonFeature[]): PhotonFeature[] {
  return [...features].sort((a, b) => {
    const aIn = isIndiaFeature(a.properties) ? 0 : 1;
    const bIn = isIndiaFeature(b.properties) ? 0 : 1;
    return aIn - bIn;
  });
}

async function searchPhoton(
  query: string,
  bias: Coords | undefined,
  signal: AbortSignal | undefined,
): Promise<PlaceSuggestion[]> {
  let url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&limit=${SEARCH_LIMIT}&lang=en&bbox=${INDIA_BBOX}`;
  if (bias) {
    url += `&lat=${bias.lat}&lon=${bias.lng}`;
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Photon search failed');
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const features = indiaFirstPhoton(data.features ?? []);
  return features.map((feat, idx) => mapPhotonFeature(feat, idx, 'photon'));
}

async function searchNominatim(
  query: string,
  bias: Coords | undefined,
  signal: AbortSignal | undefined,
): Promise<PlaceSuggestion[]> {
  let url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=${SEARCH_LIMIT}&addressdetails=1&countrycodes=in`;
  if (bias) {
    // Soft viewbox around bias (~0.3°) then fall back outside if needed
    const d = 0.3;
    url +=
      `&viewbox=${bias.lng - d},${bias.lat + d},${bias.lng + d},${bias.lat - d}` +
      `&bounded=0`;
  }
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': 'LaborLinkApp/1.0 (location search)' },
  });
  if (!res.ok) throw new Error('Nominatim search failed');
  const data = (await res.json()) as NominatimSearchHit[];
  return data.map((item, idx) => {
    const parts = item.display_name.split(',').map((s) => s.trim()).filter(Boolean);
    return {
      id: `nom-${item.place_id || idx}`,
      title: parts[0] || 'Location',
      subtitle: parts.slice(1, 4).join(', ') || 'India',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
  });
}

/**
 * Autocomplete search via Photon (Komoot), with Nominatim fallback.
 * Supports AbortSignal, in-memory cache, user-coord bias, and India-first ranking.
 */
export async function searchPlaces(
  query: string,
  bias?: Coords,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}:${bias ? `${bias.lat.toFixed(3)},${bias.lng.toFixed(3)}` : 'nobias'}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const backend = getGeocoderBackend();
  // google / mapbox reserved — fall through to Photon until keys are wired here only
  void backend;

  try {
    const suggestions =
      backend === 'nominatim'
        ? await searchNominatim(trimmed, bias, signal)
        : await searchPhoton(trimmed, bias, signal);
    searchCache.set(cacheKey, suggestions);
    return suggestions;
  } catch (err: unknown) {
    if (isAbortError(err)) throw err;
    if (backend === 'nominatim') return [];
    try {
      const suggestions = await searchNominatim(trimmed, bias, signal);
      searchCache.set(cacheKey, suggestions);
      return suggestions;
    } catch (fallbackErr: unknown) {
      if (isAbortError(fallbackErr)) throw fallbackErr;
      return [];
    }
  }
}

async function reversePhoton(coords: Coords, signal?: AbortSignal): Promise<string | null> {
  const url = `https://photon.komoot.io/reverse?lat=${coords.lat}&lon=${coords.lng}&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Photon reverse failed');
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const feat = data.features?.[0];
  if (!feat) return null;
  const p = feat.properties;
  const parts = [p.name, p.street, p.district || p.suburb || p.locality, p.city, p.state].filter(Boolean);
  return parts.join(', ') || null;
}

async function reverseNominatim(coords: Coords, signal?: AbortSignal): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}` +
    `&format=json&addressdetails=1`;
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': 'LaborLinkApp/1.0 (reverse geocode)' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  if (!data.display_name) return null;
  return data.display_name.split(',').slice(0, 3).map((s) => s.trim()).join(', ');
}

/**
 * Reverse-geocodes coordinates to a short human-readable address line.
 */
export async function reverseGeocode(coords: Coords, signal?: AbortSignal): Promise<string> {
  const cacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) return cached;

  const backend = getGeocoderBackend();
  void backend;

  try {
    const address =
      backend === 'nominatim'
        ? await reverseNominatim(coords, signal)
        : await reversePhoton(coords, signal);
    if (address) {
      reverseCache.set(cacheKey, address);
      return address;
    }
  } catch (err: unknown) {
    if (isAbortError(err)) throw err;
  }

  if (backend !== 'nominatim') {
    try {
      const address = await reverseNominatim(coords, signal);
      if (address) {
        reverseCache.set(cacheKey, address);
        return address;
      }
    } catch (err: unknown) {
      if (isAbortError(err)) throw err;
    }
  }

  const fallback = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  reverseCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Low-level Photon reverse with a feature limit (used by nearbyPlaces).
 */
export async function reversePhotonFeatures(
  coords: Coords,
  limit: number,
  signal?: AbortSignal,
): Promise<PhotonFeature[]> {
  const url =
    `https://photon.komoot.io/reverse?lat=${coords.lat}&lon=${coords.lng}` +
    `&limit=${limit}&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Photon reverse failed');
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return data.features ?? [];
}

export type { PhotonFeature };
