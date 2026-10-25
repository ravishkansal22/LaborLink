import { haversineMeters } from './distance';
import { reversePhotonFeatures } from './geocode';
import type { Coords, PlaceSuggestion } from './types';

const NEARBY_RADIUS_M = 1000;
const NEARBY_FETCH_LIMIT = 20;
const NEARBY_RESULT_LIMIT = 6;

/**
 * Returns ~6 named places within ~1 km of `coords`, sorted by distance, deduped by title.
 * Uses Photon reverse with a feature limit; returns [] on failure (rethrows AbortError).
 */
export async function nearbyPlaces(
  coords: Coords,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  try {
    const features = await reversePhotonFeatures(coords, NEARBY_FETCH_LIMIT, signal);
    const seen = new Set<string>();
    const scored: Array<PlaceSuggestion & { meters: number }> = [];

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const p = feat.properties;
      const title = p.name || p.street || p.locality || p.suburb;
      if (!title) continue;
      const titleKey = title.trim().toLowerCase();
      if (seen.has(titleKey)) continue;

      const [lng, lat] = feat.geometry.coordinates;
      const meters = haversineMeters(coords, { lat, lng });
      if (meters > NEARBY_RADIUS_M) continue;

      seen.add(titleKey);
      const subtitleParts = [p.street && p.name ? p.street : undefined, p.district || p.city, p.state]
        .filter(Boolean);
      scored.push({
        id: `nearby-${i}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
        title,
        subtitle: subtitleParts.join(', ') || 'Nearby',
        lat,
        lng,
        meters,
      });
    }

    scored.sort((a, b) => a.meters - b.meters);
    return scored.slice(0, NEARBY_RESULT_LIMIT).map(({ id, title, subtitle, lat, lng }) => ({
      id,
      title,
      subtitle,
      lat,
      lng,
    }));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return [];
  }
}
