/* Road route between the worker and the job, for drawing the path and estimating arrival.
   Uses the public OSRM routing service (no API key). If it can't be reached, falls back to a
   straight line with the same 1.3 road factor the backend uses. Coordinates are [lat, lng]. */

export type Pt = [number, number];
export interface Route { points: Pt[]; km: number; source: 'road' | 'straight' }

export const SPEED_KMH = 20; // typical city two-wheeler speed (same as the backend estimate)
const ROAD_FACTOR = 1.3;

export function distanceKm(a: Pt, b: Pt): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Compass bearing from a to b in degrees (0 = north). */
export function bearing(a: Pt, b: Pt): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
  const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function etaMinutes(km: number): number {
  return Math.max(1, Math.ceil((km / SPEED_KMH) * 60));
}

export async function fetchRoute(from: Pt, to: Pt): Promise<Route> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { routes?: Array<{ distance: number; geometry: { coordinates: Array<[number, number]> } }> };
    const best = data.routes?.[0];
    if (!best?.geometry.coordinates.length) throw new Error('no route');
    return { points: best.geometry.coordinates.map(([lng, lat]) => [lat, lng] as Pt), km: best.distance / 1000, source: 'road' };
  } catch {
    return { points: [from, to], km: distanceKm(from, to) * ROAD_FACTOR, source: 'straight' };
  } finally {
    window.clearTimeout(timer);
  }
}

/** Distance still to travel from `pos`, following the route from its nearest point. */
export function remainingKm(route: Route, pos: Pt): number {
  const end = route.points[route.points.length - 1];
  if (route.source === 'straight') return distanceKm(pos, end) * ROAD_FACTOR;
  let nearest = 0;
  let best = Infinity;
  route.points.forEach((p, i) => {
    const d = distanceKm(pos, p);
    if (d < best) { best = d; nearest = i; }
  });
  let km = best;
  for (let i = nearest; i < route.points.length - 1; i += 1) km += distanceKm(route.points[i], route.points[i + 1]);
  return km;
}

/** The point `fraction` (0..1) of the way along the route — used by the demo trip. */
export function pointAlong(route: Route, fraction: number): Pt {
  const pts = route.points;
  const target = route.points.length < 2 ? 0 : Math.min(1, Math.max(0, fraction)) * pts.slice(1).reduce((s, p, i) => s + distanceKm(pts[i], p), 0);
  let walked = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const seg = distanceKm(pts[i], pts[i + 1]);
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    walked += seg;
  }
  return pts[pts.length - 1];
}
