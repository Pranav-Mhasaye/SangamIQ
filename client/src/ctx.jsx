import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { makeT } from './i18n';
import { load, save } from './store';

export const DEMO_POS = { lat: 18.6764, lng: 73.8977, real: false };
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => load('siq_lang', 'mr'));
  const [large, setLarge] = useState(() => load('siq_large', false));
  const [pos, setPos] = useState(DEMO_POS);
  const [profile, setProfile] = useState(() => load('siq_profile', { name: '', contact: '' }));
  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => save('siq_lang', lang), [lang]);
  useEffect(() => save('siq_large', large), [large]);
  useEffect(() => save('siq_profile', profile), [profile]);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.classList.toggle('xl', large); }, [lang, large]);

  const useRealGps = (on) => {
    if (!on) return setPos(DEMO_POS);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, real: true }),
      () => setPos(DEMO_POS),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return <Ctx.Provider value={{ lang, setLang, t, large, setLarge, pos, useRealGps, profile, setProfile }}>{children}</Ctx.Provider>;
}
