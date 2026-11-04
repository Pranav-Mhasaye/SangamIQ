import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TYPE_META } from '../types';

const pin = (color, glyph, size = 34, cls = '') =>
  L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin ${cls}" style="--c:${color};width:${size}px;height:${size}px">${glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom ?? map.getZoom()); }, [center[0], center[1], zoom]); // eslint-disable-line
  return null;
}

// markers: [{id, lat, lng, type, label, dim}]  circles: [{id, lat, lng, radius, color, label}]
// people: [{id, lat, lng, label, color}] (volunteers / requests as small dots)
export default function MapView({ center, zoom = 16, markers = [], circles = [], people = [], me, onMarker, height = 260, recenter = true }) {
  const c = [center.lat, center.lng];
  return (
    <div className="map" style={{ height }}>
      <MapContainer center={c} zoom={zoom} scrollWheelZoom zoomControl={false} attributionControl>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {recenter && <Recenter center={c} />}
        {circles.map((z) => (
          <Circle key={z.id} center={[z.lat, z.lng]} radius={z.radius}
            pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.32, weight: 2 }}>
            {z.label && <Tooltip direction="top">{z.label}</Tooltip>}
          </Circle>
        ))}
        {markers.map((m) => {
          const meta = TYPE_META[m.type] || TYPE_META.helpdesk;
          return (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={pin(meta.color, meta.glyph, 34, m.dim ? 'dim' : '')}
              eventHandlers={{ click: () => onMarker && onMarker(m) }}>
              {m.label && <Tooltip direction="top" offset={[0, -14]}>{m.label}</Tooltip>}
            </Marker>
          );
        })}
        {people.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p.color || '#12305B', p.glyph || '', 16)}>
            {p.label && <Tooltip direction="top">{p.label}</Tooltip>}
          </Marker>
        ))}
        {me && <Marker position={[me.lat, me.lng]} icon={pin('#1A73E8', '', 20, 'me')} zIndexOffset={1000} />}
      </MapContainer>
    </div>
  );
}
