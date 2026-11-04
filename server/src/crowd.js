// Crowd monitoring + predictive intelligence.
// Simulates zone movements, generates 15-minute forecasts, persists samples & automatic alerts.
import { broadcast } from './bus.js';
import { getAllZones, saveZoneDensity, surgeZoneInDb, updateZoneSurgeAndAlert } from './repos/zonesRepo.js';
import { createAlert } from './repos/alertsRepo.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const riskOf = (d) => (d >= 85 ? 'critical' : d >= 70 ? 'high' : d >= 50 ? 'moderate' : 'low');

function predict(zone) {
  const h = zone.history || [zone.density, zone.density];
  const slope = (h[h.length - 1] - h[0]) / Math.max(1, h.length - 1);
  return { slope, predicted: Math.round(clamp(zone.density + slope * 15, 0, 100)) };
}

export async function snapshot() {
  const zones = await getAllZones();
  return zones.map((z) => {
    const { slope, predicted } = predict(z);
    return {
      id: z.id,
      name: z.name,
      name_mr: z.name_mr || z.name,
      name_hi: z.name_hi || z.name,
      lat: z.lat,
      lng: z.lng,
      radius: z.radius,
      capacity: z.capacity,
      density: Math.round(z.density),
      predicted,
      trend: slope > 0.8 ? 'rising' : slope < -0.8 ? 'falling' : 'steady',
      risk: riskOf(z.density),
      predictedRisk: riskOf(predicted),
      people: Math.round((z.density / 100) * z.capacity),
    };
  });
}

async function autoAlert(zone, predicted) {
  const now = Date.now();
  if (now - (zone.lastAlertAt || 0) < 120000) return;
  zone.lastAlertAt = now;
  await updateZoneSurgeAndAlert(zone.id, undefined, now);

  const n = zone.name;
  const n_mr = zone.name_mr || zone.name;
  const n_hi = zone.name_hi || zone.name;

  await createAlert({
    level: predicted >= 85 ? 'emergency' : 'warning',
    zone: zone.id,
    auto: true,
    title: `Crowd building near ${n}`,
    messages: {
      en: `Heavy crowd expected near ${n}. Please use alternate routes and keep your family together.`,
      hi: `${n_hi} के पास भारी भीड़ की संभावना है। कृपया वैकल्पिक मार्ग अपनाएं और परिवार को साथ रखें।`,
      mr: `${n_mr} जवळ मोठी गर्दी होण्याची शक्यता आहे. कृपया पर्यायी मार्ग वापरा आणि कुटुंबाला सोबत ठेवा.`,
    },
  });
}

let tickInProgress = false;
async function tick() {
  if (tickInProgress) return;
  tickInProgress = true;
  try {
    const zones = await getAllZones();
    const t = Date.now() / 1000;

    for (const z of zones) {
      if (z.surge > 0) {
        z.surge -= 1;
        await updateZoneSurgeAndAlert(z.id, z.surge, undefined);
      }
      const wave = Math.sin(t / 40 + z.base) * 8;
      const target = z.surge > 0 ? 97 : z.base + wave;
      z.density = clamp(z.density + (target - z.density) * 0.25 + (Math.random() - 0.5) * 2.5, 5, 100);

      z.history.push(z.density);
      if (z.history.length > 8) z.history.shift();

      await saveZoneDensity(z.id, Math.round(z.density));

      const { predicted } = predict(z);
      if (predicted >= 80 && z.density < 99) {
        await autoAlert(z, predicted);
      }
    }

    const currentSnapshot = await snapshot();
    broadcast('crowd:update', currentSnapshot);
  } catch (err) {
    console.warn('⚠️  Crowd simulation tick error:', err.message);
  } finally {
    tickInProgress = false;
  }
}

let timer = null;
export function startCrowdSim() {
  if (!timer) timer = setInterval(tick, 4000);
}

export async function surgeZone(id, ticks = 14) {
  return surgeZoneInDb(id, ticks);
}
