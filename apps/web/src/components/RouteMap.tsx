import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import type { FriendRouteInfo } from '../types';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© OpenStreetMap contributors';

// Interactive street map: OSM tiles, the pedestrian route polyline, and
// endpoints. All geometry comes from the backend router — never synthesized.
export function RouteMap({ route }: { route: FriendRouteInfo }) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (divRef.current === null) return;
    try {
      const reducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const map = L.map(divRef.current, {
        zoomControl: true,
        zoomAnimation: !reducedMotion,
        fadeAnimation: !reducedMotion,
      });
      mapRef.current = map;
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    } catch {
      setMapFailed(true);
      return;
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;
    try {
      const latLngs = route.geometry.coordinates.map(([lon, lat]) => L.latLng(lat, lon));
      const line = L.polyline(latLngs, { color: '#0084ff', weight: 5 }).addTo(map);
      const you = L.circleMarker([route.center.lat, route.center.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#0b3d91',
        fillOpacity: 1,
      }).addTo(map);
      const friend = L.circleMarker([route.target.lat, route.target.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#e0245e',
        fillOpacity: 1,
      }).addTo(map);
      map.fitBounds(line.getBounds().pad(0.25));
      return () => {
        line.remove();
        you.remove();
        friend.remove();
      };
    } catch {
      setMapFailed(true);
      return undefined;
    }
  }, [route]);

  return (
    <div
      ref={divRef}
      className="route-map"
      role="application"
      aria-label={`Walking route map to ${route.to.display_name}`}
    >
      {mapFailed && <p className="map-fallback">Street map could not load here.</p>}
    </div>
  );
}
