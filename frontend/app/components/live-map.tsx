'use client';

import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng { latitude: number; longitude: number }

/* Map tiles from OpenStreetMap (no API key needed). Leaflet is loaded in the browser only. */
export function LiveMap({ worker, destination, workerLabel }: { worker: LatLng | null; destination: LatLng | null; workerLabel: string }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  // Plain numbers as effect dependencies, so a re-render with equal coordinates does nothing.
  const wLat = worker?.latitude;
  const wLng = worker?.longitude;
  const dLat = destination?.latitude;
  const dLng = destination?.longitude;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import('leaflet');
      if (cancelled || !element.current) return;
      if (!map.current) {
        map.current = L.map(element.current, { zoomControl: false, attributionControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map.current);
        L.control.zoom({ position: 'bottomright' }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      map.current.invalidateSize(); // re-measure in case the map was created while hidden
      const group = layer.current!;
      group.clearLayers();
      const points: Array<[number, number]> = [];
      if (dLat != null && dLng != null) {
        const at: [number, number] = [dLat, dLng];
        L.marker(at, { icon: L.divIcon({ className: '', html: '<div class="pin-home"><span>⌂</span></div>', iconSize: [34, 34], iconAnchor: [17, 34] }) })
          .addTo(group).bindTooltip('Job location');
        points.push(at);
      }
      if (wLat != null && wLng != null) {
        const at: [number, number] = [wLat, wLng];
        L.marker(at, { icon: L.divIcon({ className: '', html: `<div class="pin-worker"><span>${escapeHtml(workerLabel)}</span></div>`, iconSize: [36, 36], iconAnchor: [18, 18] }) })
          .addTo(group).bindTooltip('Worker');
        points.push(at);
      }
      if (points.length === 2) {
        L.polyline(points, { color: '#0758d8', weight: 3, dashArray: '6 8', opacity: 0.8 }).addTo(group);
      }
      // Fit both points once, then keep the view steady so the user can pan/zoom freely.
      if (points.length && !fitted.current) {
        if (points.length === 2) map.current!.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
        else map.current!.setView(points[0], 15);
        fitted.current = points.length === 2;
      }
    })();
    return () => { cancelled = true; };
  }, [wLat, wLng, dLat, dLng, workerLabel]);

  useEffect(() => {
    // Keep tiles filling the box when it changes size (tab shown again, window resized, phone frame scaled).
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    if (element.current) observer.observe(element.current);
    const onVisible = () => { if (document.visibilityState === 'visible') map.current?.invalidateSize(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return <div ref={element} className="live-map" role="img" aria-label="Map showing the worker and the job location" />;
}

/** The worker label comes from a user-entered name and is placed into marker HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

export function googleMapsUrl(destination: LatLng, origin?: LatLng | null): string {
  const params = new URLSearchParams({ api: '1', destination: `${destination.latitude},${destination.longitude}`, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
