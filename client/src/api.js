import { useCallback, useEffect, useRef, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// One shared Server-Sent Events connection for the whole app.
const EVENTS = ['request:new', 'request:update', 'alert:new', 'crowd:update', 'volunteer:update'];
const listeners = new Set();
let source;
function ensureStream() {
  if (source) return;
  source = new EventSource(`${BASE}/api/stream`);
  EVENTS.forEach((ev) =>
    source.addEventListener(ev, (e) => {
      let data = null;
      try { data = JSON.parse(e.data); } catch { /* ignore */ }
      listeners.forEach((fn) => fn(ev, data));
    }),
  );
}
export function subscribe(fn) {
  ensureStream();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// useLive(loader, ['request:update'], [deps]) -> [data, reload]
// Loads on mount / when deps change, and reloads whenever one of the listed live events arrives.
export function useLive(loader, events = [], deps = []) {
  const [data, setData] = useState(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reload = useCallback(() => loaderRef.current().then(setData).catch(() => {}), []);
  useEffect(() => {
    reload();
    if (!events.length) return undefined;
    return subscribe((ev) => { if (events.includes(ev)) reload(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [data, reload];
}

export const ago = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};
