// Geo helpers. In production these become PostGIS queries (ST_DistanceSphere / ST_DWithin) - see /docs/schema.sql
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// Walking pace in a crowd is slow: ~70 m per minute
export const etaMin = (meters) => Math.max(1, Math.round(meters / 70));
