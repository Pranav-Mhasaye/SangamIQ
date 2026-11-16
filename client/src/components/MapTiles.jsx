/**
 * MapTiles — configurable tile layer for Leaflet.
 *
 * Default: OpenFreeMap vector tiles via MapLibre GL (free, no API key, no limits).
 * Override: set VITE_TILE_URL to use any raster tile provider (CARTO, MapTiler, etc.).
 * Fallback: on repeated tile errors, shows a plain light canvas so overlays remain visible.
 */
import { useEffect, useRef, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

/* ── env-var tile config ─────────────────────────────────────────────── */
const TILE_URL = import.meta.env.VITE_TILE_URL || '';
const TILE_ATTR = import.meta.env.VITE_TILE_ATTRIBUTION || '';
const TILE_SUBDOMAINS = import.meta.env.VITE_TILE_SUBDOMAINS || 'abc';

/* ── OpenFreeMap style URLs ──────────────────────────────────────────── */
const OFM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OFM_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> ' +
  '<a href="https://openmaptiles.org">OpenMapTiles</a> ' +
  'Data &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

/* ── Plain canvas fallback (no external tiles) ───────────────────────── */
const FALLBACK_ATTR = 'Map tiles unavailable';

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
    // subtle grid
    for (let i = 0; i < 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 256);
      ctx.moveTo(0, i); ctx.lineTo(256, i);
      ctx.stroke();
    }
    return tile;
  },
});

/* ── MapLibre GL vector layer (lazy-loaded) ──────────────────────────── */
function VectorTileLayer({ onError }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let layer = null;

    (async () => {
      try {
        // Dynamic import to keep the bundle small when VITE_TILE_URL is set
        const maplibreGl = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        await import('@maplibre/maplibre-gl-leaflet');

        if (cancelled) return;

        layer = L.maplibreGL({
          style: OFM_STYLE,
          attribution: OFM_ATTRIBUTION,
        });

        layer.addTo(map);
        layerRef.current = layer;

        // Listen for MapLibre errors (network/tile failures)
        const glMap = layer.getMaplibreMap();
        if (glMap) {
          let errorCount = 0;
          glMap.on('error', (e) => {
            errorCount++;
            if (errorCount >= 5) {
              console.info('[MapTiles] OpenFreeMap vector tiles failing, switching to fallback canvas.');
              onError?.();
            }
          });
        }
      } catch (err) {
        console.info('[MapTiles] MapLibre GL failed to load, switching to fallback canvas:', err.message);
        if (!cancelled) onError?.();
      }
    })();

    return () => {
      cancelled = true;
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

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
        console.info('[MapTiles] Raster tile errors exceeded threshold, switching to fallback canvas.');
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

/* ── Fallback canvas layer ───────────────────────────────────────────── */
function CanvasFallbackLayer() {
  const map = useMap();

  useEffect(() => {
    const layer = new FallbackTileLayer({ attribution: FALLBACK_ATTR });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map]);

  return null;
}

/* ── Exported component ──────────────────────────────────────────────── */
export default function MapTiles() {
  const [mode, setMode] = useState(() => {
    if (TILE_URL) return 'raster';
    return 'vector';
  });

  const switchToFallback = () => setMode('fallback');

  if (mode === 'fallback') {
    return (
      <>
        <CanvasFallbackLayer />
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(0,0,0,0.6)', color: '#fff',
          padding: '4px 12px', borderRadius: 6, fontSize: 12, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          Map tiles unavailable — overlays still visible
        </div>
      </>
    );
  }

  if (mode === 'raster') {
    return (
      <RasterTileLayer
        url={TILE_URL}
        attribution={TILE_ATTR || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        subdomains={TILE_SUBDOMAINS}
        onError={switchToFallback}
      />
    );
  }

  // mode === 'vector' (default: OpenFreeMap via MapLibre)
  return <VectorTileLayer onError={switchToFallback} />;
}
