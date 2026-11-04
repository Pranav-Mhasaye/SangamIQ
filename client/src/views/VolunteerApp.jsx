import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronRight, Navigation, Check, Clock, AlertTriangle, ShieldX, RefreshCw } from 'lucide-react';
import { api, useLive, ago } from '../api';
import { TYPE_META } from '../types';
import { load, save } from '../store';
import { useApp } from '../ctx';
import { useAuth } from '../auth';
import { LANGS } from '../i18n';
import MapView from '../components/MapView';

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default function VolunteerApp({ onExit }) {
  const { t, lang, setLang } = useApp();
  const { user, logout } = useAuth();
  const [meId, setMeId] = useState(() => user?.volunteerId || load('siq_vol', null));
  const [volunteers, reloadVol] = useLive(() => api('/volunteers'), ['volunteer:update']);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (user?.volunteerId) {
      setMeId(user.volunteerId);
      save('siq_vol', user.volunteerId);
    } else if (volunteers?.length) {
      const exists = volunteers.some((v) => v.id === meId);
      if (!exists) {
        const fallback = volunteers[0].id;
        setMeId(fallback);
        save('siq_vol', fallback);
      }
    }
  }, [volunteers, meId, user?.volunteerId]);

  useEffect(() => {
    if (meId) save('siq_vol', meId);
  }, [meId]);

  const me = volunteers?.find((v) => v.id === meId) || (volunteers?.length ? volunteers[0] : null);
  const status = me?.status || user?.volunteerStatus || 'approved';

  const [requests, reloadReq] = useLive(
    () => (me?.id ? api(`/requests?volunteerId=${me.id}`) : Promise.resolve([])),
    ['request:new', 'request:update', 'volunteer:update'],
    [me?.id]
  );

  const open = useMemo(() => (requests || []).filter((r) => r.status === 'open')
    .sort((a, b) => Number(b.matchedToMe) - Number(a.matchedToMe) || (b.priority === 'critical') - (a.priority === 'critical') || a.distanceM - b.distanceM), [requests]);
  const mine = (requests || []).filter((r) => r.acceptedBy === meId && r.status === 'accepted');
  const doneByMe = (requests || []).filter((r) => r.acceptedBy === meId && r.status === 'completed').length;

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  const toggleOnline = async () => {
    try {
      await api(`/volunteers/${meId}`, { method: 'PATCH', body: { online: !me.online } });
      reloadVol();
    } catch (e) {
      flash(e.message);
    }
  };

  const accept = async (id) => {
    try {
      await api(`/requests/${id}/accept`, { method: 'POST', body: { volunteerId: meId } });
      flash(t('reqAccepted'));
    } catch (e) {
      flash(e.message);
    }
    reloadReq();
  };

  const finish = async (id) => {
    try {
      await api(`/requests/${id}/complete`, { method: 'POST' });
      flash(t('markedDone'));
    } catch (e) {
      flash(e.message);
    }
    reloadReq();
  };

  if (!me) return <div className="phone"><p className="lead">{t('loading')}</p></div>;

  // Handle unapproved states
  if (status === 'pending') {
    return (
      <div className="phone">
        <header className="topbar">
          <div className="brand"><b>Sangam<span>IQ</span></b><small>{t('volDashboard')}</small></div>
          <div className="top-actions">
            <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('language')}>
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button className="icon-btn" onClick={onExit} aria-label={t('switchRole')}>
              <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </header>
        <main className="scroll" style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ margin: '40px auto 16px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#FFF3E0', padding: '16px', borderRadius: '50%' }}>
              <Clock size={48} color="#E08A00" />
            </div>
          </div>
          <h2>{t('applicationPending')}</h2>
          <p className="muted" style={{ margin: '12px 0 24px', lineHeight: 1.5 }}>
            {t('applicationPendingSub')}
          </p>
          <div className="card" style={{ padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
            <b>{me.name}</b>
            <p className="tiny muted">{me.phone}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {(me.skills || []).map((sk) => (
                <span key={sk} className="tag">{t.skill(sk)}</span>
              ))}
            </div>
          </div>
          <button className="btn ghost" onClick={() => reloadVol()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
            <RefreshCw size={16} /> Check Status
          </button>
        </main>
      </div>
    );
  }

  if (status === 'rejected' || status === 'suspended') {
    return (
      <div className="phone">
        <header className="topbar">
          <div className="brand"><b>Sangam<span>IQ</span></b><small>{t('volDashboard')}</small></div>
          <div className="top-actions">
            <button className="icon-btn" onClick={onExit} aria-label={t('switchRole')}>
              <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </header>
        <main className="scroll" style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ margin: '40px auto 16px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#FEE2E2', padding: '16px', borderRadius: '50%' }}>
              <ShieldX size={48} color="#C00000" />
            </div>
          </div>
          <h2>{status === 'rejected' ? t('applicationRejected') : t('applicationSuspended')}</h2>
          <p className="muted" style={{ margin: '12px 0 24px' }}>
            {t('contactAdmin')}
          </p>
          <button className="btn ghost" onClick={onExit}>{t('changeRole')}</button>
        </main>
      </div>
    );
  }

  return (
    <div className="phone">
      <header className="topbar">
        <div className="brand"><b>Sangam<span>IQ</span></b><small>{t('volDashboard')}</small></div>
        <div className="top-actions">
          <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('language')}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          {/* Volunteer switcher for demo testing */}
          <select className="lang" value={meId} onChange={(e) => setMeId(e.target.value)} aria-label="Select volunteer">
            {volunteers.filter((v) => v.status === 'approved' || v.verified).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={onExit} aria-label={t('switchRole')}>
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </header>
      <main className="scroll">
        <button className={`status-pill ${me.online ? 'on' : ''}`} onClick={toggleOnline} aria-pressed={me.online}>
          <span className="dot" /> {me.online ? t('volOnline') : t('volOffline')}
        </button>

        <div className="stats3">
          <div className="stat red"><b>{open.length}</b><small>{t('openRequests')}</small></div>
          <div className="stat orange"><b>{mine.length}</b><small>{t('inProgressYou')}</small></div>
          <div className="stat green"><b>{doneByMe}</b><small>{t('completedYou')}</small></div>
        </div>

        <MapView center={me} me={me} height={200} zoom={16}
          markers={[...open, ...mine].map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, type: r.type, label: t.type(r.type), dim: r.status !== 'open' }))} />

        {mine.length > 0 && <>
          <h3 className="section">{t('yourActiveTasks')}</h3>
          <ul className="list">{mine.map((r) => (
            <li key={r.id} className="card req">
              <Dot type={r.type} /><div className="grow"><b>{t.type(r.type)}</b><small>{km(r.distanceM)} · {r.etaMin} {t('minAway')} · {ago(r.createdAt)}</small>{r.note && <em>“{r.note}”</em>}</div>
              <a className="btn small ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`} aria-label={t('getDirections')}><Navigation size={16} /></a>
              <button className="btn small" onClick={() => finish(r.id)}><Check size={16} /> {t('done')}</button>
            </li>))}</ul>
        </>}

        <h3 className="section">{t('incomingRequests')}</h3>
        {!me.online && <p className="muted">{t('goOnlineHint')}</p>}
        {open.length === 0 && <p className="muted">{t('noOpenRequests')}</p>}
        <ul className="list">{open.map((r) => (
          <li key={r.id} className={`card req ${r.priority}`}>
            <Dot type={r.type} />
            <div className="grow">
              <b>{t.type(r.type)} {r.priority === 'critical' && <span className="tag crit">{t('emergency')}</span>}{r.matchedToMe && <span className="tag">{t('matchedToYou')}</span>}</b>
              <small>{km(r.distanceM)} {t('minAway')} · {r.etaMin} min · {ago(r.createdAt)}{r.channel === 'voice' ? ` · ${t('viaVoice')}` : ''}</small>
              {r.note && <em>“{r.note}”</em>}
            </div>
            <button className="btn small" disabled={!me.online || me.activeRequestId === r.id} onClick={() => accept(r.id)}>{t('accept')}</button>
          </li>))}</ul>
      </main>
      {toast && <div className="toast"><Bell size={16} /> {toast}</div>}
    </div>
  );
}

function Dot({ type }) {
  const { Icon, color } = TYPE_META[type];
  return <span className="ticon" style={{ '--c': color }}><Icon size={22} strokeWidth={2.4} /></span>;
}
