import { useState } from 'react';
import { ChevronRight, RotateCcw, Radio, TrendingUp, TrendingDown, Minus, Users, LayoutDashboard, Check, X, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { api, useLive, ago } from '../api';
import { RISK_COLOR, TYPE_META } from '../types';
import MapView from '../components/MapView';

const CENTER = { lat: 18.6764, lng: 73.8977 };
const LABEL = { medical: 'Medical', water: 'Water', food: 'Food', toilet: 'Toilet', helpdesk: 'Help desk', transport: 'Transport' };
const fmtSec = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

export default function OrganiserApp({ onExit }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'volunteers'
  const [zones] = useLive(() => api('/crowd'), ['crowd:update']);
  const [stats] = useLive(() => api('/stats'), ['request:new', 'request:update', 'volunteer:update']);
  const [requests] = useLive(() => api('/requests'), ['request:new', 'request:update']);
  const [volunteers, reloadVolunteers] = useLive(() => api('/auth/volunteers/all'), ['volunteer:update']);
  const [alerts, reloadAlerts] = useLive(() => api('/alerts'), ['alert:new']);
  const [form, setForm] = useState({ level: 'warning', title: '', message: '', mr: '', hi: '', zone: '' });
  const [msg, setMsg] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const broadcast = async (e) => {
    e.preventDefault();
    try {
      await api('/alerts', { method: 'POST', body: { ...form, zone: form.zone || null } });
      setForm({ ...form, title: '', message: '', mr: '', hi: '' });
      flash('Alert sent to all attendees'); reloadAlerts();
    } catch (er) { flash(er.message); }
  };

  const surge = (id) => api(`/crowd/${id}/surge`, { method: 'POST' });
  const reset = async () => { await api('/demo/reset', { method: 'POST' }); flash('Demo data reset'); window.location.reload(); };

  const setVolunteerStatus = async (id, status) => {
    try {
      await api(`/auth/volunteers/${id}/status`, { method: 'PATCH', body: { status } });
      flash(`Volunteer status updated to ${status}`);
      reloadVolunteers();
    } catch (err) {
      flash(err.message);
    }
  };

  const danger = (zones || []).filter((z) => ['high', 'critical'].includes(z.predictedRisk));
  const pendingCount = (volunteers || []).filter((v) => v.status === 'pending').length;

  return (
    <div className="desk">
      <header className="topbar wide">
        <div className="brand">
          <b>Sangam<span>IQ</span></b>
          <small>Organiser Control Room</small>
        </div>

        <div className="seg" style={{ margin: '0 16px' }}>
          <button
            type="button"
            className={tab === 'overview' ? 'on' : ''}
            onClick={() => setTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LayoutDashboard size={16} /> Overview
          </button>
          <button
            type="button"
            className={tab === 'volunteers' ? 'on' : ''}
            onClick={() => setTab('volunteers')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={16} /> Volunteers
            {pendingCount > 0 && (
              <span className="tag crit" style={{ padding: '1px 6px', fontSize: '0.7rem' }}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        <div className="top-actions">
          <button className="btn small ghost" onClick={reset}><RotateCcw size={16} /> Reset demo data</button>
          <button className="icon-btn" onClick={onExit} aria-label="Switch role"><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>
        </div>
      </header>

      {danger.length > 0 && (
        <div className="banner emergency wide"><Radio size={18} /> Forecast: {danger.map((z) => `${z.name} → ${z.predicted}% in 15 min`).join(' · ')}</div>
      )}

      {tab === 'overview' ? (
        <>
          {stats && (
            <section className="stats5">
              <div className="stat red"><b>{stats.open}</b><small>Open requests</small></div>
              <div className="stat orange"><b>{stats.inProgress}</b><small>In progress</small></div>
              <div className="stat green"><b>{stats.completed}</b><small>Resolved</small></div>
              <div className="stat"><b>{fmtSec(stats.avgResponseSec)}</b><small>Avg. time to accept</small></div>
              <div className="stat"><b>{stats.volunteersOnline}/{stats.volunteersTotal}</b><small>Volunteers online</small></div>
            </section>
          )}

          <section className="desk-grid">
            <div className="panel">
              <h3>Live crowd heatmap</h3>
              <MapView center={CENTER} zoom={16} height={420} recenter={false}
                circles={(zones || []).map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, radius: z.radius, color: RISK_COLOR[z.risk], label: `${z.name}: ${z.density}% (${z.risk})` }))}
                markers={(requests || []).filter((r) => r.status === 'open').map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, type: r.type, label: `${LABEL[r.type]} request` }))}
                people={(volunteers || []).filter((v) => v.online).map((v) => ({ id: v.id, lat: v.lat, lng: v.lng, label: v.name, color: '#12305B' }))} />
              <p className="tiny muted">Coloured zones = crowd density. Pins = open help requests. Navy dots = online volunteers.</p>
            </div>

            <div className="panel">
              <h3>Zones &amp; 15-minute forecast</h3>
              <table className="table">
                <thead><tr><th>Zone</th><th>Now</th><th>In 15 min</th><th></th></tr></thead>
                <tbody>
                  {(zones || []).map((z) => (
                    <tr key={z.id}>
                      <td><b>{z.name}</b><small>{z.people.toLocaleString()} people</small></td>
                      <td><Bar v={z.density} risk={z.risk} /></td>
                      <td><Bar v={z.predicted} risk={z.predictedRisk} /> <Trend t={z.trend} /></td>
                      <td><button className="btn small ghost" onClick={() => surge(z.id)}>Simulate surge</button></td>
                    </tr>))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h3>Broadcast an alert</h3>
              <form className="form" onSubmit={broadcast}>
                <div className="row">
                  <label className="field"><span>Level</span>
                    <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}><option value="info">Info</option><option value="warning">Warning</option><option value="emergency">Emergency</option></select></label>
                  <label className="field"><span>Zone (optional)</span>
                    <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}><option value="">Whole event</option>{(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
                </div>
                <label className="field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <label className="field"><span>Message (English)</span><textarea required rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
                <label className="field"><span>मराठी (optional)</span><textarea rows={2} value={form.mr} onChange={(e) => setForm({ ...form, mr: e.target.value })} /></label>
                <label className="field"><span>हिंदी (optional)</span><textarea rows={2} value={form.hi} onChange={(e) => setForm({ ...form, hi: e.target.value })} /></label>
                <button className="btn sos"><span className="sos-main">Send alert</span></button>
              </form>
            </div>

            <div className="panel">
              <h3>Recent alerts</h3>
              <ul className="list">{(alerts || []).slice(0, 6).map((a) => (
                <li key={a.id} className={`alert ${a.level}`}><b>{a.title}</b><p>{a.messages.en}</p><small>{ago(a.createdAt)}{a.auto ? ' · automatic forecast alert' : ''}</small></li>))}</ul>
            </div>

            <div className="panel wide2">
              <h3>Help requests</h3>
              <table className="table">
                <thead><tr><th>Type</th><th>Status</th><th>Priority</th><th>Channel</th><th>Volunteer</th><th>Raised</th></tr></thead>
                <tbody>
                  {(requests || []).slice(0, 12).map((r) => {
                    const { Icon, color } = TYPE_META[r.type];
                    return (
                      <tr key={r.id}>
                        <td><span className="ticon sm" style={{ '--c': color }}><Icon size={14} strokeWidth={2.4} /></span> {LABEL[r.type]}</td>
                        <td><span className={`tag ${r.status}`}>{r.status}</span></td>
                        <td>{r.priority === 'critical' ? <span className="tag crit">critical</span> : r.priority}</td>
                        <td>{r.channel}</td><td>{r.volunteer?.name || '-'}</td><td>{ago(r.createdAt)}</td>
                      </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        /* VOLUNTEERS TAB */
        <section style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 16px' }}>
          <div className="stats3" style={{ marginBottom: '20px' }}>
            <div className="stat green">
              <b>{(volunteers || []).filter((v) => v.status === 'approved').length}</b>
              <small>Approved &amp; active</small>
            </div>
            <div className="stat red">
              <b>{pendingCount}</b>
              <small>Pending approval</small>
            </div>
            <div className="stat orange">
              <b>{(volunteers || []).filter((v) => ['suspended', 'rejected'].includes(v.status)).length}</b>
              <small>Suspended / Rejected</small>
            </div>
          </div>

          <div className="panel wide2">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Volunteer Directory &amp; Verification</h3>
              <small className="muted">Only approved volunteers are marked verified and dispatched to live help requests.</small>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Volunteer</th>
                  <th>Contact</th>
                  <th>Skills</th>
                  <th>Status</th>
                  <th>Live State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(volunteers || []).map((v) => {
                  const status = v.status || (v.verified ? 'approved' : 'pending');
                  return (
                    <tr key={v.id}>
                      <td>
                        <b>{v.name}</b>
                        <small>{v.id}</small>
                      </td>
                      <td>
                        <span>{v.phone}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(v.skills || []).map((sk) => (
                            <span key={sk} className="tag" style={{ fontSize: '0.72rem' }}>
                              {sk}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            status === 'approved' ? 'completed' : status === 'pending' ? 'crit' : 'cancelled'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: v.online ? '#2E9E5B' : '#9CA3AF',
                            }}
                          />
                          <small>{v.online ? 'Online' : 'Offline'}</small>
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {status === 'pending' && (
                            <>
                              <button
                                className="btn small"
                                style={{ background: '#2E9E5B' }}
                                onClick={() => setVolunteerStatus(v.id, 'approved')}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                className="btn small ghost"
                                style={{ color: '#C00000', borderColor: '#C00000' }}
                                onClick={() => setVolunteerStatus(v.id, 'rejected')}
                              >
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}
                          {status === 'approved' && (
                            <button
                              className="btn small ghost"
                              style={{ color: '#E08A00', borderColor: '#E08A00' }}
                              onClick={() => setVolunteerStatus(v.id, 'suspended')}
                            >
                              <ShieldAlert size={14} /> Suspend
                            </button>
                          )}
                          {(status === 'suspended' || status === 'rejected') && (
                            <button
                              className="btn small"
                              style={{ background: '#2E9E5B' }}
                              onClick={() => setVolunteerStatus(v.id, 'approved')}
                            >
                              <UserCheck size={14} /> Re-approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

function Bar({ v, risk }) {
  return <span className="bar" title={`${v}% - ${risk}`}><i style={{ width: `${v}%`, background: RISK_COLOR[risk] }} /><em>{v}%</em></span>;
}
function Trend({ t }) {
  const I = t === 'rising' ? TrendingUp : t === 'falling' ? TrendingDown : Minus;
  return <I size={16} className={`trend ${t}`} aria-label={t} />;
}
