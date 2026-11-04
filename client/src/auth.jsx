// Auth context: manages login state, token storage, and provides auth actions.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, clearAccessToken, onAuthChange } from './api';
import { load, save } from './store';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);         // { id, role, name, phone, email, volunteerId, volunteerStatus }
  const [loading, setLoading] = useState(true);    // true while checking refresh token on mount
  const [guestMode, setGuestMode] = useState(() => load('siq_guest', false));

  // Device ID for guest attendees (persisted so they can track their requests)
  const [deviceId] = useState(() => {
    let id = load('siq_device_id', null);
    if (!id) {
      id = 'dev_' + crypto.randomUUID();
      save('siq_device_id', id);
    }
    return id;
  });

  // On mount, try to restore session from refresh token cookie
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${(import.meta.env.VITE_API_URL || '')}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      } catch { /* no session */ }
      setLoading(false);
    })();

    // Listen for token refresh events
    return onAuthChange((u) => setUser(u));
  }, []);

  // ---------- Auth actions ----------

  const sendOtp = useCallback(async (phone) => {
    await api('/auth/send-otp', { method: 'POST', body: { phone } });
  }, []);

  const verifyOtp = useCallback(async (phone, otp, role = 'attendee') => {
    const data = await api('/auth/verify-otp', { method: 'POST', body: { phone, otp, role } });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setGuestMode(false);
    save('siq_guest', false);
    return data.user;
  }, []);

  const registerVolunteer = useCallback(async (phone, otp, name, skills) => {
    const data = await api('/auth/register-volunteer', { method: 'POST', body: { phone, otp, name, skills } });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setGuestMode(false);
    save('siq_guest', false);
    return data.user;
  }, []);

  const loginOrganiser = useCallback(async (email, password) => {
    const data = await api('/auth/login-organiser', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setGuestMode(false);
    save('siq_guest', false);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearAccessToken();
    setUser(null);
    setGuestMode(false);
    save('siq_guest', false);
    save('siq_role', null);
  }, []);

  const enterGuest = useCallback(() => {
    setGuestMode(true);
    save('siq_guest', true);
  }, []);

  const value = {
    user, loading, guestMode, deviceId,
    sendOtp, verifyOtp, registerVolunteer, loginOrganiser, logout, enterGuest,
    isLoggedIn: !!user,
    isVolunteer: user?.role === 'volunteer',
    isOrganiser: user?.role === 'organiser' || user?.role === 'admin',
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

