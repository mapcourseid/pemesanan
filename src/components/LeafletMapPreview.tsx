import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Map as MapIcon, Globe, Layers } from 'lucide-react';

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

  // Layer references
  const osmLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLabelsRef = useRef<L.TileLayer | null>(null);

  // Basemap State: 'osm' (OpenStreetMap) | 'satellite' (Esri World Imagery)
  const [baseMap, setBaseMap] = useState<'osm' | 'satellite'>('osm');

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

      // 1. OpenStreetMap Layer
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> kontributor',
        maxZoom: 19,
      });

      // 2. High-Resolution Esri World Imagery (Citra Satelit)
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community',
          maxZoom: 19,
        }
      );

      // 3. Batas & Label Wilayah Satelit (Overlay)
      const satelliteLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 19,
        }
      );

      osmLayerRef.current = osmLayer;
      satelliteLayerRef.current = satelliteLayer;
      satelliteLabelsRef.current = satelliteLabels;

      // Default basemap: OpenStreetMap
      osmLayer.addTo(map);

      // Layer control standar Leaflet
      const baseMaps = {
        '🗺️ OpenStreetMap': osmLayer,
        '🛰️ Citra Satelit': satelliteLayer,
      };
      L.control.layers(baseMaps, undefined, { position: 'bottomright' }).addTo(map);

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

  // Update Basemap saat pengguna memilih opsi di UI
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !osmLayerRef.current || !satelliteLayerRef.current) return;

    if (baseMap === 'satellite') {
      if (map.hasLayer(osmLayerRef.current)) {
        map.removeLayer(osmLayerRef.current);
      }
      if (!map.hasLayer(satelliteLayerRef.current)) {
        satelliteLayerRef.current.addTo(map);
      }
      if (satelliteLabelsRef.current && !map.hasLayer(satelliteLabelsRef.current)) {
        satelliteLabelsRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(satelliteLayerRef.current)) {
        map.removeLayer(satelliteLayerRef.current);
      }
      if (satelliteLabelsRef.current && map.hasLayer(satelliteLabelsRef.current)) {
        map.removeLayer(satelliteLabelsRef.current);
      }
      if (!map.hasLayer(osmLayerRef.current)) {
        osmLayerRef.current.addTo(map);
      }
    }
  }, [baseMap]);

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
            opacity: 0.95,
            fillColor: '#34d399',
            fillOpacity: 0.4,
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
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {/* Floating Basemap Selector Controls */}
      <div className="absolute top-3 right-3 z-[400] flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200/80 gap-1">
        <button
          type="button"
          onClick={() => setBaseMap('osm')}
          title="Tampilan Peta Jalan OpenStreetMap"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            baseMap === 'osm'
              ? 'bg-[#7d3feb] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">OpenStreetMap</span>
          <span className="sm:hidden">Peta</span>
        </button>

        <button
          type="button"
          onClick={() => setBaseMap('satellite')}
          title="Tampilan Citra Satelit Resolusi Tinggi"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            baseMap === 'satellite'
              ? 'bg-[#7d3feb] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Citra Satelit</span>
          <span className="sm:hidden">Satelit</span>
        </button>
      </div>

      {interactive && onCoordinatesChange && (
        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow border border-slate-200 pointer-events-none">
          💡 Klik pada peta untuk menetapkan titik koordinat lokasi
        </div>
      )}
    </div>
  );
};
