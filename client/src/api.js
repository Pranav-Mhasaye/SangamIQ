import { useCallback, useEffect, useRef, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || '';

// ---------- token management ----------
let accessToken = null;

export function setAccessToken(token) { accessToken = token; }
export function getAccessToken() { return accessToken; }
export function clearAccessToken() { accessToken = null; }

// ---------- api() with auth ----------

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    credentials: 'include', // send cookies for refresh token
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401 and we have a token, try refreshing
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with new token
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${BASE}/api${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryData.error || retry.statusText);
      return retryData;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Try to refresh the access token using the httpOnly cookie
async function tryRefresh() {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) { clearAccessToken(); return false; }
    const data = await res.json();
    accessToken = data.accessToken;
    // Notify listeners that auth changed
    authListeners.forEach((fn) => fn(data.user));
    return true;
  } catch {
    clearAccessToken();
    return false;
  }
}

// Auth change listeners (used by AuthProvider)
const authListeners = new Set();
export function onAuthChange(fn) {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
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
