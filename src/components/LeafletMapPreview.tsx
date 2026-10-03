import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LeafletMapPreviewProps {
  center?: [number, number];
  zoom?: number;
  coordinates?: { lat: number; lng: number };
  polygonGeoJson?: any;
  onCoordinatesChange?: (coords: { lat: number; lng: number }) => void;
  interactive?: boolean;
  height?: string;
}

export const LeafletMapPreview: React.FC<LeafletMapPreviewProps> = ({
  center = [-6.2088, 106.8456], // Default Jakarta
  zoom = 13,
  coordinates,
  polygonGeoJson,
  onCoordinatesChange,
  interactive = true,
  height = '350px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter: [number, number] = coordinates
        ? [coordinates.lat, coordinates.lng]
        : center;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom,
        zoomControl: true,
      });

      // CartoDB Positron / OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (interactive && onCoordinatesChange) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          onCoordinatesChange({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          });
        });
      }

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (coordinates && coordinates.lat && coordinates.lng) {
      if (!markerRef.current) {
        markerRef.current = L.marker([coordinates.lat, coordinates.lng]).addTo(map);
      } else {
        markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
      }

      if (!polygonGeoJson) {
        map.setView([coordinates.lat, coordinates.lng], 15);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [coordinates, polygonGeoJson]);

  // Update GeoJSON layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.remove();
      geoJsonLayerRef.current = null;
    }

    if (polygonGeoJson) {
      try {
        const geoLayer = L.geoJSON(polygonGeoJson, {
          style: {
            color: '#10b981',
            weight: 3,
            opacity: 0.9,
            fillColor: '#34d399',
            fillOpacity: 0.35,
          },
          onEachFeature: (_feature, layer) => {
            layer.bindPopup(
              `<div class="p-1 font-sans">
                <strong class="text-emerald-700">Polygon Lahan KKPR</strong><br/>
                <span class="text-xs text-slate-600">Terdaftar dan Terstandarisasi ATR/BPN</span>
              </div>`
            );
          },
        }).addTo(map);

        geoJsonLayerRef.current = geoLayer;
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      } catch (err) {
        console.error('Error rendering GeoJSON:', err);
      }
    }
  }, [polygonGeoJson]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      {interactive && onCoordinatesChange && (
        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow border border-slate-200">
          💡 Klik pada peta untuk menetapkan titik koordinat lokasi
        </div>
      )}
    </div>
  );
};
