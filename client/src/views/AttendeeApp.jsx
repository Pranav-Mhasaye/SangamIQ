import { useEffect, useMemo, useState } from 'react';
import { Home, Map as MapIcon, Bell, User, Mic, PhoneCall, Navigation, ArrowLeft, MapPin, LocateFixed, ShieldCheck, Siren, ChevronRight, Check } from 'lucide-react';
import { api, useLive, ago } from '../api';
import { useApp } from '../ctx';
import { LANGS } from '../i18n';
import { TYPE_META, TYPE_IDS } from '../types';
import MapView from '../components/MapView';
import VoiceSheet from '../components/VoiceSheet';
import { load, save } from '../store';

const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

function TypeIcon({ type, size = 26 }) {
  const { Icon, color } = TYPE_META[type];
  return <span className="ticon" style={{ '--c': color }}><Icon size={size} strokeWidth={2.4} /></span>;
}

export default function AttendeeApp({ onExit }) {
  const { t, lang, setLang, pos, useRealGps } = useApp();
  const [tab, setTab] = useState('home');
  const [screen, setScreen] = useState(null); // {name:'request', type?} | {name:'detail', id} | {name:'track', id}
  const [voice, setVoice] = useState(false);
  const [filter, setFilter] = useState(null);
  const [activeId, setActiveId] = useState(() => load('siq_active_req', null));

  useEffect(() => save('siq_active_req', activeId), [activeId]);

  const [services] = useLive(() => api(`/services?lat=${pos.lat}&lng=${pos.lng}`), [], [pos.lat, pos.lng]);
  const [alerts] = useLive(() => api('/alerts'), ['alert:new']);
  const [active] = useLive(
    async () => {
      if (!activeId) return null;
      try {
        return await api(`/requests/${activeId}`);
      } catch (err) {
        setActiveId(null);
        save('siq_active_req', null);
        return null;
      }
    },
    ['request:update'],
    [activeId]
  );

  const locName = (s) => (s ? ((lang === 'mr' && s.name_mr) || (lang === 'hi' && s.name_hi) || s.name) : '');
  const shown = useMemo(() => (services || []).filter((s) => !filter || s.type === filter), [services, filter]);
  const nearest = shown.slice(0, 3);
  const banner = (alerts || []).find((a) => a.level !== 'info');
  const inFlight = active && ['open', 'accepted'].includes(active.status);

  const openTrack = (id, close = true) => { setActiveId(id); setScreen({ name: 'track', id }); if (close) setVoice(false); };

  if (screen?.name === 'request') return <RequestScreen initialType={screen.type} onBack={() => setScreen(null)} onSent={(id) => openTrack(id)} />;
  if (screen?.name === 'detail') return <DetailScreen id={screen.id} onBack={() => setScreen(null)} onRequest={(type) => setScreen({ name: 'request', type })} />;
  if (screen?.name === 'track') return <TrackScreen id={screen.id} onBack={() => setScreen(null)} onDone={() => { setActiveId(null); setScreen(null); }} />;

  return (
    <div className="phone">
      <header className="topbar">
        <div className="brand"><b>Sangam<span>IQ</span></b><small>{t('tagline')}</small></div>
        <div className="top-actions">
          <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('language')}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      </header>

      <main className="scroll">
        {tab === 'home' && (
          <>
            {banner && <div className={`banner ${banner.level}`}><Bell size={18} /><span>{banner.messages[lang] || banner.messages.en}</span></div>}
            {inFlight && (
              <button className="banner track" onClick={() => setScreen({ name: 'track', id: active.id })}>
                <Siren size={18} /><span>{t(`st_${active.status}`)}</span><ChevronRight size={18} />
              </button>
            )}
            <div className="chip"><MapPin size={16} /> {pos.real ? t('yourLocation') : t('demoLocation')}
              <button className="icon-btn tiny-btn" onClick={() => useRealGps(!pos.real)} aria-label={t('useGps')}><LocateFixed size={16} /></button></div>

            <div className="tiles">
              {TYPE_IDS.map((id) => (
                <button key={id} className={`tile ${filter === id ? 'on' : ''}`} onClick={() => setFilter(filter === id ? null : id)} aria-pressed={filter === id}>
                  <TypeIcon type={id} /><span>{t.type(id)}</span>
                </button>
              ))}
            </div>

            <MapView center={pos} me={pos} height={250} markers={shown.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, type: s.type, label: locName(s) }))}
              onMarker={(m) => setScreen({ name: 'detail', id: m.id })} />

            <h3 className="section">{t('nearby')}</h3>
            <ul className="list">
              {nearest.map((s) => (
                <li key={s.id}>
                  <button className="row-card" onClick={() => setScreen({ name: 'detail', id: s.id })}>
                    <TypeIcon type={s.type} />
                    <div className="grow"><b>{locName(s)}</b><small>{km(s.distanceM)} · {s.etaMin} {t('minAway')}</small></div>
                    <ChevronRight size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'map' && (
          <>
            <div className="tiles compact">
              <button className={`tile ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}><span>{t('allTypes')}</span></button>
              {TYPE_IDS.map((id) => (
                <button key={id} className={`tile ${filter === id ? 'on' : ''}`} onClick={() => setFilter(filter === id ? null : id)}><TypeIcon type={id} size={20} /></button>
              ))}
            </div>
            <MapView center={pos} me={pos} zoom={16} height="calc(100dvh - 220px)" markers={shown.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, type: s.type, label: locName(s) }))}
              onMarker={(m) => setScreen({ name: 'detail', id: m.id })} />
          </>
        )}

        {tab === 'alerts' && <AlertsTab alerts={alerts} />}
        {tab === 'profile' && <ProfileTab onExit={onExit} />}
      </main>

      {(tab === 'home' || tab === 'map') && (
        <div className="cta-bar compact">
          <button className="btn sos" onClick={() => setScreen({ name: 'request' })}>
            <span className="sos-main">{t('requestHelp')}</span><small>{t('tapEmergency')}</small>
          </button>
          <button className="btn voice" onClick={() => setVoice(true)} aria-label={t('speak')}><Mic size={24} /></button>
        </div>
      )}

      <nav className="tabbar">
        {[['home', Home, 'home'], ['map', MapIcon, 'map'], ['alerts', Bell, 'alerts'], ['profile', User, 'profile']].map(([id, Icon, key]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={22} /><span>{t(key)}</span></button>
        ))}
      </nav>

      {voice && <VoiceSheet onClose={() => setVoice(false)} onRequest={openTrack} />}
    </div>
  );
}

function RequestScreen({ initialType, onBack, onSent }) {
  const { t, lang, pos, profile } = useApp();
  const [type, setType] = useState(initialType || null);
  const [emergency, setEmergency] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setBusy(true); setErr('');
    try {
      const chosenType = type || (emergency ? 'medical' : null);
      const r = await api('/requests', {
        method: 'POST',
        body: {
          type: chosenType,
          emergency,
          note,
          language: lang,
          lat: pos.lat,
          lng: pos.lng,
          name: profile.name,
        },
      });
      onSent(r.id);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="phone">
      <header className="topbar back"><button className="icon-btn" onClick={onBack} aria-label={t('back')}><ArrowLeft size={22} /></button><h1>{t('requestHelp')}</h1></header>
      <main className="scroll">
        <p className="lead">{t('selectType')}</p>
        <div className="grid2">
          {TYPE_IDS.map((id) => (
            <button key={id} className={`pick ${type === id ? 'on' : ''}`} onClick={() => setType(id)}>
              <TypeIcon type={id} size={30} /><b>{t.type(id)}</b>
            </button>
          ))}
        </div>
        <button className={`emergency-row ${emergency ? 'on' : ''}`} onClick={() => setEmergency(!emergency)}>
          <Siren size={26} /><div className="grow"><b>{t('emergency')}</b><small>{t('emergencySub')}</small></div>{emergency ? <Check size={22} /> : <ChevronRight size={22} />}
        </button>
        <label className="field"><span>{t('noteLabel')}</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} /></label>
        {err && <p className="error">{err}</p>}
      </main>
      <div className="cta-bar col">
        <button className="btn sos" disabled={busy || (!type && !emergency)} onClick={send}><span className="sos-main">{t('sendRequest')}</span></button>
        <p className="tiny muted center"><ShieldCheck size={14} /> {t('locationShared')}</p>
      </div>
    </div>
  );
}

function DetailScreen({ id, onBack, onRequest }) {
  const { t, lang, pos } = useApp();
  const [s] = useLive(() => api(`/services/${id}?lat=${pos.lat}&lng=${pos.lng}`), [], [id]);
  if (!s) return <div className="phone"><header className="topbar back"><button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button></header></div>;
  const { color } = TYPE_META[s.type];
  const sName = (lang === 'mr' && s.name_mr) || (lang === 'hi' && s.name_hi) || s.name;
  return (
    <div className="phone">
      <header className="topbar back"><button className="icon-btn" onClick={onBack} aria-label={t('back')}><ArrowLeft size={22} /></button><h1>{sName}</h1></header>
      <main className="scroll">
        <div className="hero" style={{ '--c': color }}><TypeIcon type={s.type} size={40} /><div><b>{t.type(s.type)}</b><small>{km(s.distanceM)} · {s.etaMin} {t('minAway')}</small></div>
          {s.verified && <span className="badge"><ShieldCheck size={14} /> {t('verified')}</span>}</div>
        <MapView center={{ lat: s.lat, lng: s.lng }} me={pos} zoom={17} height={180} markers={[{ id: s.id, lat: s.lat, lng: s.lng, type: s.type, label: sName }]} />
        <dl className="facts">
          <dt>{t('openHours')}</dt><dd>{s.hours}</dd>
          {s.operator && <><dt>{t('runBy')}</dt><dd>{s.operator}</dd></>}
          <dt>{t('available')}</dt><dd>{(s.services || []).join(', ')}</dd>
        </dl>
      </main>
      <div className="cta-bar col">
        <a className="btn sos" target="_blank" rel="noreferrer" href={mapsLink(s.lat, s.lng)}><Navigation size={20} /> <span className="sos-main">{t('getDirections')}</span></a>
        <div className="row">
          {s.contact && <a className="btn ghost" href={`tel:${s.contact.phone.replace(/\s/g, '')}`}><PhoneCall size={18} /> {t('callVolunteer')}</a>}
          <button className="btn ghost" onClick={() => onRequest(s.type)}>{t('requestHere')}</button>
        </div>
      </div>
    </div>
  );
}

function TrackScreen({ id, onBack, onDone }) {
  const { t, lang, pos } = useApp();
  const [r, reload] = useLive(
    async () => {
      try {
        return await api(`/requests/${id}`);
      } catch (err) {
        onDone();
        return null;
      }
    },
    ['request:update'],
    [id]
  );
  if (!r) return <div className="phone"><header className="topbar back"><button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button></header></div>;
  const steps = [['open', t('st_open')], ['accepted', t('st_accepted')], ['completed', t('st_completed')]];
  const idx = r.status === 'cancelled' ? -1 : steps.findIndex(([k]) => k === r.status);
  const act = async (what) => { await api(`/requests/${id}/${what}`, { method: 'POST' }); reload(); if (what === 'cancel') onDone(); };
  const v = r.volunteer;
  const nsName = r.nearestService ? (((lang === 'mr' && r.nearestService.name_mr) || (lang === 'hi' && r.nearestService.name_hi) || r.nearestService.name)) : '';
  return (
    <div className="phone">
      <header className="topbar back"><button className="icon-btn" onClick={onBack} aria-label={t('back')}><ArrowLeft size={22} /></button><h1>{t('yourRequest')}</h1></header>
      <main className="scroll">
        <div className="hero" style={{ '--c': TYPE_META[r.type].color }}><TypeIcon type={r.type} size={34} />
          <div><b>{t.type(r.type)}</b><small>{ago(r.createdAt)}{r.priority === 'critical' ? ` · ${t('emergency')}` : ''}</small></div></div>
        {r.status === 'cancelled' ? <p className="lead">{t('st_cancelled')}</p> : (
          <ol className="steps">{steps.map(([k, label], i) => <li key={k} className={i <= idx ? 'done' : ''}><span>{i < idx || r.status === 'completed' ? <Check size={14} /> : ''}</span>{label}</li>)}</ol>
        )}
        {v ? (
          <div className="card person"><div className="avatar">{v.name[0]}</div><div className="grow"><b>{v.name}</b><small>{(v.skills || []).map((sk) => t.skill(sk)).join(', ')}</small></div>
            <a className="btn small" href={`tel:${v.phone.replace(/\s/g, '')}`}><PhoneCall size={16} /></a></div>
        ) : r.status === 'open' && (
          <>
            <h3 className="section">{t('alertedVolunteers')}</h3>
            <ul className="list">{r.matched.map((m) => (
              <li key={m.volunteerId} className="card person"><div className="avatar">{m.name[0]}</div>
                <div className="grow"><b>{m.name}</b><small>{km(m.distanceM)} · {m.etaMin} {t('minAway')}</small></div></li>))}</ul>
          </>
        )}
        {r.nearestService && (
          <a className="row-card" target="_blank" rel="noreferrer" href={mapsLink(r.nearestService.lat, r.nearestService.lng)}>
            <TypeIcon type={r.type} /><div className="grow"><b>{nsName}</b><small>{t('getDirections')}</small></div><Navigation size={20} /></a>
        )}
      </main>
      {['open', 'accepted'].includes(r.status) && (
        <div className="cta-bar col">
          <button className="btn sos" onClick={() => act('complete')}><span className="sos-main">{t('gotHelp')}</span></button>
          {r.status === 'open' && <button className="btn ghost" onClick={() => act('cancel')}>{t('cancel')}</button>}
        </div>
      )}
      {['completed', 'cancelled'].includes(r.status) && <div className="cta-bar"><button className="btn sos" onClick={onDone}><span className="sos-main">{t('close')}</span></button></div>}
    </div>
  );
}

function AlertsTab({ alerts }) {
  const { t, lang } = useApp();
  if (!alerts) return null;
  if (!alerts.length) return <p className="lead">{t('noAlerts')}</p>;
  return (
    <ul className="list">
      {alerts.map((a) => (
        <li key={a.id} className={`alert ${a.level}`}>
          <b>{a.title}</b><p>{a.messages[lang] || a.messages.en}</p>
          <small>{ago(a.createdAt)}{a.auto ? ' · AI crowd forecast' : ''}</small>
        </li>
      ))}
    </ul>
  );
}

function ProfileTab({ onExit }) {
  const { t, lang, setLang, large, setLarge, pos, useRealGps, profile, setProfile } = useApp();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="form">
      <label className="field"><span>{t('yourName')}</span><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
      <label className="field"><span>{t('emergencyContact')}</span><input inputMode="tel" value={profile.contact} onChange={(e) => setProfile({ ...profile, contact: e.target.value })} /></label>
      <div className="field"><span>{t('language')}</span>
        <div className="seg">{LANGS.map((l) => <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>{l.label}</button>)}</div></div>
      <label className="switch"><input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} /><span>{t('largeText')}</span></label>
      <label className="switch"><input type="checkbox" checked={pos.real} onChange={(e) => useRealGps(e.target.checked)} /><span>{t('useGps')}</span></label>
      {profile.contact && <a className="btn ghost" href={`tel:${profile.contact.replace(/\s/g, '')}`}><PhoneCall size={18} /> {profile.contact}</a>}

      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
        {confirming ? (
          <div className="row">
            <button className="btn small" onClick={onExit}>{t('confirmChangeRole')}</button>
            <button className="btn small ghost" onClick={() => setConfirming(false)}>{t('cancel')}</button>
          </div>
        ) : (
          <button className="btn ghost" style={{ width: '100%' }} onClick={() => setConfirming(true)}>{t('changeRole')}</button>
        )}
      </div>
    </div>
  );
}
