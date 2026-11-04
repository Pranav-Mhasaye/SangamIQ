// Crowd monitoring + predictive intelligence (prototype).
// A simulator moves zone densities; a linear-trend forecast looks 15 simulated minutes ahead
// and raises an automatic alert when a zone is predicted to become dangerous.
// Replace `tick()` input with real sensors / CCTV counts / telecom footfall, keep `snapshot()`.
import { db, uid } from './data.js';
import { broadcast } from './bus.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const riskOf = (d) => (d >= 85 ? 'critical' : d >= 70 ? 'high' : d >= 50 ? 'moderate' : 'low');

function predict(zone) {
  const h = zone.history;
  const slope = (h[h.length - 1] - h[0]) / (h.length - 1); // % per tick (1 tick = 1 simulated minute)
  return { slope, predicted: Math.round(clamp(zone.density + slope * 15, 0, 100)) };
}

export function snapshot() {
  return db.zones.map((z) => {
    const { slope, predicted } = predict(z);
    return {
      id: z.id, name: z.name, lat: z.lat, lng: z.lng, radius: z.radius, capacity: z.capacity,
      density: Math.round(z.density), predicted, trend: slope > 0.8 ? 'rising' : slope < -0.8 ? 'falling' : 'steady',
      risk: riskOf(z.density), predictedRisk: riskOf(predicted), people: Math.round((z.density / 100) * z.capacity),
    };
  });
}

function autoAlert(zone, predicted) {
  const now = Date.now();
  if (now - zone.lastAlertAt < 120000) return;
  zone.lastAlertAt = now;
  const n = zone.name;
  const alert = {
    id: uid('alt'), level: predicted >= 85 ? 'emergency' : 'warning', zone: zone.id, createdAt: new Date().toISOString(), auto: true,
    title: `Crowd building near ${n}`,
    messages: {
      en: `Heavy crowd expected near ${n}. Please use alternate routes and keep your family together.`,
      hi: `${n} के पास भारी भीड़ की संभावना है। कृपया वैकल्पिक मार्ग अपनाएं और परिवार को साथ रखें।`,
      mr: `${n} जवळ मोठी गर्दी होण्याची शक्यता आहे. कृपया पर्यायी मार्ग वापरा आणि कुटुंबाला सोबत ठेवा.`,
    },
  };
  db.alerts.unshift(alert);
  broadcast('alert:new', alert);
}

function tick() {
  const t = Date.now() / 1000;
  for (const z of db.zones) {
    if (z.surge > 0) z.surge -= 1;
    const wave = Math.sin(t / 40 + z.base) * 8; // slow natural ebb and flow
    const target = z.surge > 0 ? 97 : z.base + wave;
    z.density = clamp(z.density + (target - z.density) * 0.25 + (Math.random() - 0.5) * 2.5, 5, 100);
    z.history.push(z.density);
    if (z.history.length > 8) z.history.shift();
    const { predicted } = predict(z);
    if (predicted >= 80 && z.density < 99) autoAlert(z, predicted);
  }
  broadcast('crowd:update', snapshot());
}

let timer;
export function startCrowdSim() {
  if (!timer) timer = setInterval(tick, 4000);
}

export function surgeZone(id, ticks = 14) {
  const z = db.zones.find((x) => x.id === id);
  if (!z) return null;
  z.surge = ticks;
  z.lastAlertAt = 0;
  return z;
}
