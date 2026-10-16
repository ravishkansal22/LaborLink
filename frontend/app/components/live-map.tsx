'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { bearing, distanceKm, type Pt } from '../lib/route';
import 'leaflet/dist/leaflet.css';

export interface LatLng { latitude: number; longitude: number }

const toPt = (p: LatLng): Pt => [p.latitude, p.longitude];
const ARROW = '<div class="nav-marker"><div class="nav-arrow"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2.5 19.5 21 12 16.8 4.5 21Z" fill="#fff"/></svg></div></div>';
const HOME = '<div class="pin-home"><span>⌂</span></div>';

/**
 * Full-bleed live map (Leaflet + OpenStreetMap tiles, no API key).
 * The worker marker glides between updates and points the way they are heading; in follow
 * mode the map keeps the worker and the destination in view until the user drags it.
 */
export function LiveMap({ worker, destination, route, bottomInset = 0 }: {
  worker: LatLng | null; destination: LatLng | null; route: Pt[] | null; bottomInset?: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const workerMarker = useRef<Leaflet.Marker | null>(null);
  const homeMarker = useRef<Leaflet.Marker | null>(null);
  const routeLayer = useRef<Leaflet.LayerGroup | null>(null);
  const frame = useRef<number | null>(null);
  const heading = useRef(0);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((lib) => {
      if (cancelled || !element.current || map.current) return;
      L.current = lib;
      map.current = lib.map(element.current, { zoomControl: false, attributionControl: true }).setView([28.6139, 77.209], 13);
      lib.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map.current);
      routeLayer.current = lib.layerGroup().addTo(map.current);
      map.current.on('dragstart', () => setFollow(false));
      setReady(true);
    });
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    if (element.current) observer.observe(element.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const dLat = destination?.latitude;
  const dLng = destination?.longitude;
  useEffect(() => {
    if (!ready || dLat == null || dLng == null) return;
    const lib = L.current!;
    if (!homeMarker.current) {
      homeMarker.current = lib.marker([dLat, dLng], { icon: lib.divIcon({ className: '', html: HOME, iconSize: [34, 34], iconAnchor: [17, 34] }) }).addTo(map.current!);
    } else homeMarker.current.setLatLng([dLat, dLng]);
  }, [ready, dLat, dLng]);

  const routeKey = route ? `${route.length}:${route[0]?.join()}:${route[route.length - 1]?.join()}` : '';
  useEffect(() => {
    if (!ready) return;
    const lib = L.current!;
    routeLayer.current!.clearLayers();
    if (route && route.length > 1) {
      lib.polyline(route, { color: '#ffffff', weight: 9, opacity: 0.95 }).addTo(routeLayer.current!);
      lib.polyline(route, { color: '#0758d8', weight: 5, opacity: 0.95 }).addTo(routeLayer.current!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routeKey]);

  // Move the worker marker smoothly to each new position.
  const wLat = worker?.latitude;
  const wLng = worker?.longitude;
  useEffect(() => {
    if (!ready || wLat == null || wLng == null) return;
    const lib = L.current!;
    const target: Pt = [wLat, wLng];
    const marker = workerMarker.current;
    if (!marker) {
      workerMarker.current = lib.marker(target, { icon: lib.divIcon({ className: '', html: ARROW, iconSize: [40, 40], iconAnchor: [20, 20] }), zIndexOffset: 1000 }).addTo(map.current!);
      return;
    }
    const from = marker.getLatLng();
    const start: Pt = [from.lat, from.lng];
    if (distanceKm(start, target) > 0.005) heading.current = bearing(start, target);
    const arrow = marker.getElement()?.querySelector<HTMLElement>('.nav-arrow');
    if (arrow) arrow.style.transform = `rotate(${heading.current}deg)`;
    if (frame.current) cancelAnimationFrame(frame.current);
    if (document.hidden) { marker.setLatLng(target); return; } // no animation frames in a background tab
    const began = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 1500);
      const eased = t * (2 - t);
      marker.setLatLng([start[0] + (target[0] - start[0]) * eased, start[1] + (target[1] - start[1]) * eased]);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [ready, wLat, wLng]);

  // Keep both points in view (above the bottom sheet) while following.
  useEffect(() => {
    if (!ready || !follow) return;
    const lib = L.current!;
    const points: Pt[] = [];
    if (wLat != null && wLng != null) points.push([wLat, wLng]);
    if (dLat != null && dLng != null) points.push([dLat, dLng]);
    if (points.length === 1 && route && route.length > 1) points.push(...route); // no live position yet: show the whole route
    if (points.length >= 2) {
      map.current!.fitBounds(lib.latLngBounds(points), { paddingTopLeft: [40, 90], paddingBottomRight: [40, bottomInset + 40], maxZoom: 17, animate: !document.hidden });
    } else if (points.length === 1) {
      map.current!.setView(points[0], 15, { animate: !document.hidden });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, follow, wLat, wLng, dLat, dLng, bottomInset, routeKey]);

  return (
    <div className="live-map-wrap">
      <div ref={element} className="live-map" role="img" aria-label="Map showing the worker and the job location" />
      {!follow && (
        <button type="button" className="recenter" onClick={() => setFollow(true)} aria-label="Re-center map">
          <LocateFixed size={20} />
        </button>
      )}
    </div>
  );
}

export function googleMapsUrl(destination: LatLng, origin?: LatLng | null): string {
  const params = new URLSearchParams({ api: '1', destination: `${destination.latitude},${destination.longitude}`, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export { toPt };
