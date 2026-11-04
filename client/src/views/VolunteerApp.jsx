import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronRight, Navigation, Check } from 'lucide-react';
import { api, useLive, ago } from '../api';
import { TYPE_META } from '../types';
import { load, save } from '../store';
import MapView from '../components/MapView';

const LABEL = { medical: 'Medical Help', water: 'Water Request', food: 'Food Request', toilet: 'Toilet Help', helpdesk: 'Help Desk', transport: 'Transport' };
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default function VolunteerApp({ onExit }) {
  const [meId, setMeId] = useState(() => load('siq_vol', null));
  const [volunteers, reloadVol] = useLive(() => api('/volunteers'), ['volunteer:update']);
  const [toast, setToast] = useState('');

  useEffect(() => { if (!meId && volunteers?.length) setMeId(volunteers[0].id); }, [volunteers, meId]);
  useEffect(() => save('siq_vol', meId), [meId]);

  const me = volunteers?.find((v) => v.id === meId);
  const [requests, reloadReq] = useLive(() => (meId ? api(`/requests?volunteerId=${meId}`) : Promise.resolve([])), ['request:new', 'request:update'], [meId]);

  const open = useMemo(() => (requests || []).filter((r) => r.status === 'open')
    .sort((a, b) => Number(b.matchedToMe) - Number(a.matchedToMe) || (b.priority === 'critical') - (a.priority === 'critical') || a.distanceM - b.distanceM), [requests]);
  const mine = (requests || []).filter((r) => r.acceptedBy === meId && r.status === 'accepted');
  const doneByMe = (requests || []).filter((r) => r.acceptedBy === meId && r.status === 'completed').length;

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  const toggleOnline = async () => { await api(`/volunteers/${meId}`, { method: 'PATCH', body: { online: !me.online } }); reloadVol(); };
  const accept = async (id) => {
    try { await api(`/requests/${id}/accept`, { method: 'POST', body: { volunteerId: meId } }); flash('Request accepted'); }
    catch (e) { flash(e.message); }
    reloadReq();
  };
  const finish = async (id) => { await api(`/requests/${id}/complete`, { method: 'POST' }); flash('Marked as done'); reloadReq(); };

  if (!me) return <div className="phone"><p className="lead">Loading…</p></div>;

  return (
    <div className="phone">
      <header className="topbar">
        <div className="brand"><b>Sangam<span>IQ</span></b><small>Volunteer Dashboard</small></div>
        <div className="top-actions">
          <select className="lang" value={meId} onChange={(e) => setMeId(e.target.value)} aria-label="Volunteer">
            {volunteers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <button className="icon-btn" onClick={onExit} aria-label="Switch role"><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>
        </div>
      </header>
      <main className="scroll">
        <button className={`status-pill ${me.online ? 'on' : ''}`} onClick={toggleOnline} aria-pressed={me.online}>
          <span className="dot" /> {me.online ? 'You are online - receiving requests' : 'You are offline - tap to go online'}
        </button>

        <div className="stats3">
          <div className="stat red"><b>{open.length}</b><small>Open requests</small></div>
          <div className="stat orange"><b>{mine.length}</b><small>In progress (you)</small></div>
          <div className="stat green"><b>{doneByMe}</b><small>Completed (you)</small></div>
        </div>

        <MapView center={me} me={me} height={200} zoom={16}
          markers={[...open, ...mine].map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, type: r.type, label: LABEL[r.type], dim: r.status !== 'open' }))} />

        {mine.length > 0 && <>
          <h3 className="section">Your active tasks</h3>
          <ul className="list">{mine.map((r) => (
            <li key={r.id} className="card req">
              <Dot type={r.type} /><div className="grow"><b>{LABEL[r.type]}</b><small>{km(r.distanceM)} · {r.etaMin} min · {ago(r.createdAt)}</small>{r.note && <em>“{r.note}”</em>}</div>
              <a className="btn small ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}&travelmode=walking`} aria-label="Directions"><Navigation size={16} /></a>
              <button className="btn small" onClick={() => finish(r.id)}><Check size={16} /> Done</button>
            </li>))}</ul>
        </>}

        <h3 className="section">Incoming requests</h3>
        {!me.online && <p className="muted">Go online to accept requests.</p>}
        {open.length === 0 && <p className="muted">No open requests right now. New ones appear here instantly.</p>}
        <ul className="list">{open.map((r) => (
          <li key={r.id} className={`card req ${r.priority}`}>
            <Dot type={r.type} />
            <div className="grow">
              <b>{LABEL[r.type]} {r.priority === 'critical' && <span className="tag crit">Emergency</span>}{r.matchedToMe && <span className="tag">Matched to you</span>}</b>
              <small>{km(r.distanceM)} away · {r.etaMin} min · {ago(r.createdAt)}{r.channel === 'voice' ? ' · via voice' : ''}</small>
              {r.note && <em>“{r.note}”</em>}
            </div>
            <button className="btn small" disabled={!me.online || me.activeRequestId === r.id} onClick={() => accept(r.id)}>Accept</button>
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
