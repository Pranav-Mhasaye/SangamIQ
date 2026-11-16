import { useEffect, useMemo, useState } from 'react';
import { Home, Map as MapIcon, Bell, User, Mic, PhoneCall, Navigation, ArrowLeft, MapPin, LocateFixed, ShieldCheck, Siren, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { api, useLive, ago } from '../api';
import { useApp } from '../ctx';
import { useAuth } from '../auth';
import { LANGS } from '../i18n';
import { TYPE_META, TYPE_IDS } from '../types';
import MapView from '../components/MapView';
import VoiceSheet from '../components/VoiceSheet';
import { load, save } from '../store';

const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

function calcDistAndEta(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const q = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  const distM = Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(q))));
  const etaMin = Math.max(1, Math.round(distM / 70));
  return { distM, etaMin };
}

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
  const { deviceId } = useAuth();
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
          deviceId,
        },
      });
      onSent(r.id);
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes('already requested')) {
        setErr(t('duplicateRequest'));
      } else {
        setErr(e.message);
      }
      setBusy(false);
    }
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
  const { t, lang } = useApp();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [r, reload] = useLive(
    async () => {
      try {
        return await api(`/requests/${id}`);
      } catch (err) {
        onDone();
        return null;
      }
    },
    ['request:update', 'volunteer:update'],
    [id]
  );
  if (!r) return <div className="phone"><header className="topbar back"><button className="icon-btn" onClick={onBack}><ArrowLeft size={22} /></button></header></div>;

  const steps = [
    ['open', t('st_open')],
    ['accepted', t('st_accepted')],
    ['on_the_way', t('st_on_the_way')],
    ['arrived', t('st_arrived')],
    ['completed', t('st_completed')],
  ];
  const stepIdxMap = {
    open: 0,
    escalated: 0,
    accepted: 1,
    on_the_way: 2,
    arrived: 3,
    completed: 4,
    cancelled: -1,
  };
  const idx = stepIdxMap[r.status] ?? 0;

  const act = async (what) => {
    await api(`/requests/${id}/${what}`, { method: 'POST' });
    reload();
    if (what === 'cancel') onDone();
  };

  const submitFeedbackAction = async () => {
    if (!rating) return;
    setSubmittingFeedback(true);
    try {
      await api(`/requests/${id}/feedback`, {
        method: 'POST',
        body: { rating, comment },
      });
      setFeedbackSubmitted(true);
      reload();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const v = r.volunteer;
  const vEta = v && Number.isFinite(v.lat) && Number.isFinite(v.lng)
    ? calcDistAndEta(v, { lat: r.lat, lng: r.lng })
    : null;
  const nsName = r.nearestService ? (((lang === 'mr' && r.nearestService.name_mr) || (lang === 'hi' && r.nearestService.name_hi) || r.nearestService.name)) : '';

  return (
    <div className="phone">
      <header className="topbar back"><button className="icon-btn" onClick={onBack} aria-label={t('back')}><ArrowLeft size={22} /></button><h1>{t('yourRequest')}</h1></header>
      <main className="scroll">
        <div className="hero" style={{ '--c': TYPE_META[r.type].color }}><TypeIcon type={r.type} size={34} />
          <div><b>{t.type(r.type)}</b><small>{ago(r.createdAt)}{r.priority === 'critical' ? ` · ${t('emergency')}` : ''}</small></div></div>

        {r.status === 'cancelled' ? (
          <p className="lead">{t('st_cancelled')}</p>
        ) : (
          <ol className="steps">{steps.map(([k, label], i) => <li key={k} className={i <= idx ? 'done' : ''}><span>{i < idx || r.status === 'completed' ? <Check size={14} /> : ''}</span>{label}</li>)}</ol>
        )}

        {r.status === 'escalated' && !r.maxEscalated && (
          <div className="card" style={{ background: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412', margin: '12px 0', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <AlertTriangle size={18} color="#EA580C" /> {t('st_escalated')}
            </div>
            <small style={{ display: 'block', marginTop: '4px' }}>
              Round {r.escalationRound || 1}: Alerting wider volunteer radius...
            </small>
          </div>
        )}

        {(r.maxEscalated || r.escalationRound >= 3) && (
          <div className="card" style={{ background: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B', margin: '12px 0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <AlertTriangle size={20} color="#DC2626" /> {t('nearestPhysicalPoint')}
            </div>
            {r.nearestService && (
              <div style={{ marginTop: '10px' }}>
                <a className="btn sos small" target="_blank" rel="noreferrer" href={mapsLink(r.nearestService.lat, r.nearestService.lng)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Navigation size={16} /> <span>{nsName} ({t('getDirections')})</span>
                </a>
              </div>
            )}
          </div>
        )}

        {v ? (
          <>
            <div className="card person"><div className="avatar">{v.name[0]}</div>
              <div className="grow">
                <b>{v.name}</b>
                <small>{(v.skills || []).map((sk) => t.skill(sk)).join(', ')}</small>
                {vEta && (
                  <small style={{ display: 'block', color: 'var(--brand-navy, #12305B)', fontWeight: 600 }}>
                    {km(vEta.distM)} · ~{vEta.etaMin} {t('minAway')}
                  </small>
                )}
              </div>
              <a className="btn small" href={`tel:${v.phone.replace(/\s/g, '')}`}><PhoneCall size={16} /></a>
            </div>

            {['accepted', 'on_the_way'].includes(r.status) && v.lat && v.lng && (
              <div style={{ margin: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <small className="muted" style={{ fontWeight: 600 }}>{t('liveVolunteerTracking')}</small>
                  {vEta && <span className="tag" style={{ background: '#E0F2FE', color: '#0369A1' }}>~{vEta.etaMin} {t('minAway')}</span>}
                </div>
                <MapView
                  center={{ lat: (r.lat + v.lat) / 2, lng: (r.lng + v.lng) / 2 }}
                  height={160}
                  zoom={16}
                  markers={[
                    { id: 'you', lat: r.lat, lng: r.lng, type: r.type, label: t('yourLocation') },
                    { id: 'vol', lat: v.lat, lng: v.lng, type: 'transport', label: `${v.name} (${t('onTheWay')})` },
                  ]}
                />
              </div>
            )}
          </>
        ) : ['open', 'escalated'].includes(r.status) && (
          <>
            <h3 className="section">{t('alertedVolunteers')}</h3>
            <ul className="list">{r.matched.map((m) => (
              <li key={m.volunteerId} className="card person"><div className="avatar">{m.name[0]}</div>
                <div className="grow"><b>{m.name}</b><small>{km(m.distanceM)} · {m.etaMin} {t('minAway')}</small></div></li>))}</ul>
          </>
        )}

        {r.status === 'completed' && (
          (r.rating || feedbackSubmitted) ? (
            <div className="card" style={{ padding: '16px', textAlign: 'center', margin: '16px 0', background: '#F0FDF4', borderColor: '#BBF7D0' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>
                {['', '😞', '🙁', '😐', '😊', '🌟'][(r.rating || rating) || 5]}
              </div>
              <b>{t('thankYouFeedback')}</b>
              <p className="tiny muted" style={{ marginTop: '4px' }}>
                {r.rating || rating} / 5 ⭐ {(r.feedback || comment) && `— “${r.feedback || comment}”`}
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '16px', margin: '16px 0' }}>
              <b style={{ display: 'block', fontSize: '16px', marginBottom: '4px' }}>{t('howWasHelp')}</b>
              <p className="tiny muted" style={{ marginBottom: '12px' }}>{t('rateExperience')}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                {[
                  { score: 1, emoji: '😞' },
                  { score: 2, emoji: '🙁' },
                  { score: 3, emoji: '😐' },
                  { score: 4, emoji: '😊' },
                  { score: 5, emoji: '🌟' },
                ].map(({ score, emoji }) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setRating(score)}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      fontSize: '24px',
                      borderRadius: '10px',
                      border: rating === score ? '2px solid var(--brand-red, #C00000)' : '1px solid var(--border)',
                      background: rating === score ? '#FEF2F2' : 'var(--bg-card, #fff)',
                      cursor: 'pointer',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('optionalComment')}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', resize: 'none' }}
              />
              <button
                className="btn small"
                disabled={!rating || submittingFeedback}
                onClick={submitFeedbackAction}
                style={{ marginTop: '8px', width: '100%' }}
              >
                {t('submitFeedback')}
              </button>
            </div>
          )
        )}

        {r.nearestService && !r.maxEscalated && (
          <a className="row-card" target="_blank" rel="noreferrer" href={mapsLink(r.nearestService.lat, r.nearestService.lng)}>
            <TypeIcon type={r.type} /><div className="grow"><b>{nsName}</b><small>{t('getDirections')}</small></div><Navigation size={20} /></a>
        )}

        {r.timeline && r.timeline.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h3 className="section">{t('timeline')}</h3>
            <ul className="list" style={{ gap: '8px' }}>
              {r.timeline.map((entry, i) => (
                <li key={i} className="card" style={{ padding: '8px 12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {t(`st_${entry.status}`) || entry.status.replace(/_/g, ' ')}
                    </span>
                    <small className="muted">{ago(entry.timestamp)}</small>
                  </div>
                  <div className="tiny muted" style={{ marginTop: '2px' }}>
                    {entry.actor} {entry.note ? `· ${entry.note}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      {['open', 'escalated', 'accepted', 'on_the_way', 'arrived'].includes(r.status) && (
        <div className="cta-bar col">
          <button className="btn sos" onClick={() => act('complete')}><span className="sos-main">{t('gotHelp')}</span></button>
          {['open', 'escalated'].includes(r.status) && <button className="btn ghost" onClick={() => act('cancel')}>{t('cancel')}</button>}
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
  const { user, guestMode, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="form">
      {user ? (
        <div className="card" style={{ padding: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <small className="muted">{t('loggedInAs')}</small>
              <b style={{ display: 'block' }}>{user.phone || user.name || user.id}</b>
            </div>
            <button className="btn small ghost" onClick={logout}>{t('signOut')}</button>
          </div>
        </div>
      ) : guestMode ? (
        <div className="banner info" style={{ marginBottom: '12px' }}>
          <ShieldCheck size={18} />
          <span>{t('guestBadge')}</span>
        </div>
      ) : null}

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
