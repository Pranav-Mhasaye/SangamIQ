/**
 * MapTiles — configurable tile layer for Leaflet with resilient fallbacks.
 *
 * 1. Default: OpenFreeMap vector tiles via MapLibre GL Leaflet bridge (free, no API key, unlimited).
 *    Worker is bundled via Vite's `?url` import and explicitly registered via `setWorkerUrl`.
 * 2. If MapLibre fails or worker cannot load: automatically degrades to raster tiles.
 * 3. If raster tiles also fail (e.g. offline / repeated network errors): degrades to a canvas grid
 *    with a "Map tiles unavailable" notice, keeping all pins, zones and GPS markers visible.
 */
import { useEffect, useRef, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';

// Explicitly register the Vite-emitted worker URL before any map instance is created
try {
  setWorkerUrl(workerUrl);
} catch (e) {
  console.warn('[MapTiles] setWorkerUrl error:', e);
}

/* ── Configuration ───────────────────────────────────────────────────── */
const TILE_URL = import.meta.env.VITE_TILE_URL || '';
const TILE_ATTR = import.meta.env.VITE_TILE_ATTRIBUTION || '';
const TILE_SUBDOMAINS = import.meta.env.VITE_TILE_SUBDOMAINS || 'abc';

// OpenFreeMap vector tile style
const OFM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OFM_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> ' +
  '<a href="https://openmaptiles.org">OpenMapTiles</a> ' +
  'Data &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

// Default raster fallback URL when vector fails or when VITE_TILE_URL is unset
const DEFAULT_RASTER_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DEFAULT_RASTER_ATTR =
  '&copy; <a href="https://carto.com">CARTO</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const FALLBACK_ATTR = 'Map tiles unavailable';

/* ── Plain canvas fallback layer (offline / zero external assets) ────── */
const FallbackTileLayer = L.GridLayer.extend({
  createTile() {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    // subtle grid pattern
    for (let i = 0; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 256);
      ctx.moveTo(0, i); ctx.lineTo(256, i);
      ctx.stroke();
    }
    return tile;
  },
});

function CanvasFallbackLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = new FallbackTileLayer({ attribution: FALLBACK_ATTR });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map]);
  return null;
}

/* ── MapLibre GL vector layer ────────────────────────────────────────── */
function VectorTileLayer({ onError }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    let layer = null;
    let switched = false;

    const triggerFallback = (reason) => {
      if (switched) return;
      switched = true;
      console.info(`[MapTiles] Vector map fallback triggered: ${reason}`);
      onError?.();
    };

    try {
      layer = L.maplibreGL({
        style: OFM_STYLE,
        attribution: OFM_ATTRIBUTION,
      });

      layer.addTo(map);
      layerRef.current = layer;

      // Monitor underlying MapLibre map for worker or render errors
      const glMap = layer.getMaplibreMap();
      if (glMap) {
        let errorCount = 0;
        glMap.on('error', (e) => {
          errorCount++;
          const msg = e?.error?.message || e?.message || '';
          // If worker fails to load or multiple errors occur, degrade to raster immediately
          if (msg.includes('Worker') || msg.includes('worker') || errorCount >= 3) {
            triggerFallback(msg || 'MapLibre worker/render errors');
          }
        });
      }
    } catch (err) {
      triggerFallback(err.message || 'Initialization exception');
    }

    return () => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, onError]);

  return null;
}

/* ── Raster tile layer with error detection ──────────────────────────── */
function RasterTileLayer({ url, attribution, subdomains, onError }) {
  const map = useMap();
  const errorCountRef = useRef(0);

  useEffect(() => {
    const handler = () => {
      errorCountRef.current++;
      if (errorCountRef.current >= 5) {
        console.info('[MapTiles] Raster tile errors exceeded threshold, switching to canvas fallback.');
        onError?.();
      }
    };
    map.on('tileerror', handler);
    return () => map.off('tileerror', handler);
  }, [map, onError]);

  return (
    <TileLayer
      url={url}
      attribution={attribution}
      subdomains={subdomains}
      maxZoom={19}
    />
  );
}

/* ── Main MapTiles component ─────────────────────────────────────────── */
export default function MapTiles() {
  // If VITE_TILE_URL is provided, use raster directly; otherwise start with vector
  const [mode, setMode] = useState(() => (TILE_URL ? 'raster' : 'vector'));

  const handleVectorError = () => {
    // Vector mode failed -> switch to raster mode
    setMode('raster');
  };

  const handleRasterError = () => {
    // Raster mode failed -> switch to plain canvas fallback
    setMode('fallback');
  };

  if (mode === 'fallback') {
    return (
      <>
        <CanvasFallbackLayer />
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(0,0,0,0.65)', color: '#fff',
          padding: '4px 12px', borderRadius: 6, fontSize: 12, pointerEvents: 'none',
          whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}>
          Map tiles unavailable — overlays still visible
        </div>
      </>
    );
  }

  if (mode === 'raster') {
    return (
      <RasterTileLayer
        url={TILE_URL || DEFAULT_RASTER_URL}
        attribution={TILE_ATTR || (TILE_URL ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' : DEFAULT_RASTER_ATTR)}
        subdomains={TILE_SUBDOMAINS}
        onError={handleRasterError}
      />
    );
  }

  // mode === 'vector' (default: OpenFreeMap vector tiles with MapLibre worker)
  return <VectorTileLayer onError={handleVectorError} />;
}
