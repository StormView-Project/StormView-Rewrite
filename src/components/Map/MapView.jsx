import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RadarLayer } from './RadarLayer';
import { AqiLayer } from './AqiLayer';

// Heavy (~pulls in the Open-Meteo file reader + wasm) — only load it when the
// user actually selects the Open-Meteo radar source.
const OpenMeteoRadarLayer = lazy(() =>
  import('./OpenMeteoRadarLayer').then((m) => ({ default: m.OpenMeteoRadarLayer }))
);
import { AlertPolygonLayer } from './AlertPolygonLayer';
import { MapContextMenu } from './MapContextMenu';
import useAppStore from '../../store/useAppStore';
import { useTheme } from '../../hooks/useTheme';
import './MapView.css';

// Fix Leaflet default icon paths in Vite
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
});

/* Custom styled pin */
const createLocationIcon = (theme) =>
  L.divIcon({
    className: '',
    html: `<div class="location-pin ${theme === 'light' ? 'location-pin--light' : ''}">
             <div class="location-pin-dot"></div>
           </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

/* Base map tile layers — OpenStreetMap (free, no API key).
   Dark mode uses a CSS filter on the tile container to invert the light tiles into
   a clean dark map without needing a separate dark tile server. */
const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: 'tile-layer-dark',
    maxZoom: 19,
  },
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: '',
    maxZoom: 19,
  },
};

/** Toggles the Esri satellite imagery layer beneath the radar */
function SatelliteLayer() {
  const map = useMap();
  const showSatellite = useAppStore((s) => s.showSatellite);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!showSatellite) return;
    layerRef.current = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxZoom: 19, zIndex: 5 }
    ).addTo(map);
    return () => {
      try { map.removeLayer(layerRef.current); } catch {}
      layerRef.current = null;
    };
  }, [map, showSatellite]);

  return null;
}

/** Inner component to sync map state */
function MapController({ location, theme, mapRef, onContextMenu, onMap }) {
  const map = useMap();
  const tileLayerRef = useRef(null);
  const setMapZoom = useAppStore((s) => s.setMapZoom);

  // Expose map instance to parent
  useEffect(() => { mapRef.current = map; onMap?.(map); }, [map, mapRef, onMap]);

  // Leaflet measures its container once and only re-measures on window resize.
  // If the container is still settling when the map mounts (layout/CSS not
  // final yet), tiles only load for that initial area and the rest of the map
  // stays blank. Re-measure whenever the container itself changes size.
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  useMapEvents({
    zoomend: () => setMapZoom(map.getZoom()),
    contextmenu: (e) => {
      e.originalEvent.preventDefault();
      const { clientX: rawX, clientY: rawY } = e.originalEvent;
      // Adjust so the menu doesn't overflow the viewport edges
      const x = Math.min(rawX, window.innerWidth - 224);
      const y = Math.min(rawY, window.innerHeight - 200);
      onContextMenu({ x: Math.max(4, x), y: Math.max(4, y), lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });

  // Fly to new location
  useEffect(() => {
    if (location?.lat && location?.lon) {
      map.flyTo([location.lat, location.lon], 8, { duration: 1.2 });
    }
  }, [map, location]);

  // Swap tile layer on theme change
  useEffect(() => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const def = TILE_LAYERS[theme] ?? TILE_LAYERS.dark;
    const layer = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: def.maxZoom,
      className: def.className,
    });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
    return () => {
      try { map.removeLayer(layer); } catch {}
    };
  }, [map, theme]);

  return null;
}

export function MapView({ onMap }) {
  const location    = useAppStore((s) => s.location);
  const mapZoom     = useAppStore((s) => s.mapZoom);
  const mapLayer    = useAppStore((s) => s.mapLayer);
  const radarSource = useAppStore((s) => s.radarSource);
  const theme       = useTheme();

  const mapRef = useRef(null);
  const [menu, setMenu] = useState(null);

  const center = location ? [location.lat, location.lon] : [39.5, -98.35];

  return (
    <div className="map-wrapper">
      <MapContainer
        center={center}
        zoom={mapZoom}
        zoomControl={true}
        className="leaflet-container"
        preferCanvas={false}
        attributionControl={true}
      >
        <MapController
          location={location}
          theme={theme}
          mapRef={mapRef}
          onMap={onMap}
          onContextMenu={setMenu}
        />
        <SatelliteLayer />
        {mapLayer === 'radar'
          ? (radarSource === 'openmeteo'
              ? <Suspense fallback={null}><OpenMeteoRadarLayer /></Suspense>
              : <RadarLayer />)
          : <AqiLayer />}
        <AlertPolygonLayer />
        {location && (
          <Marker
            position={[location.lat, location.lon]}
            icon={createLocationIcon(theme)}
          >
            <Popup className="map-popup">
              <span>{location.name}{location.state ? `, ${location.state}` : ''}</span>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {menu && (
        <MapContextMenu
          lat={menu.lat}
          lon={menu.lon}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          mapRef={mapRef}
        />
      )}
    </div>
  );
}
