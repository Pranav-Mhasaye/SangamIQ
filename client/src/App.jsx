import { useState } from 'react';
import { Users, HeartHandshake, LayoutDashboard } from 'lucide-react';
import { AppProvider } from './ctx';
import { load, save } from './store';
import AttendeeApp from './views/AttendeeApp';
import VolunteerApp from './views/VolunteerApp';
import OrganiserApp from './views/OrganiserApp';

const ROLES = [
  { id: 'attendee', Icon: Users, title: 'Attendee', body: 'Find water, food, toilets, medical help and transport. Ask for help by tapping or by speaking in Marathi, Hindi or English.' },
  { id: 'volunteer', Icon: HeartHandshake, title: 'Volunteer', body: 'Go online, see the nearest requests matched to your skills, accept them and mark them done.' },
  { id: 'organiser', Icon: LayoutDashboard, title: 'Organiser', body: 'Watch the live crowd heatmap and 15-minute forecast, track every request and broadcast alerts.' },
];

export default function App() {
  const [role, setRole] = useState(() => load('siq_role', null));
  const choose = (r) => { setRole(r); save('siq_role', r); };

  return (
    <AppProvider>
      {role === 'attendee' && <AttendeeApp onExit={() => choose(null)} />}
      {role === 'volunteer' && <VolunteerApp onExit={() => choose(null)} />}
      {role === 'organiser' && <OrganiserApp onExit={() => choose(null)} />}
      {!role && (
        <div className="gate">
          <div className="gate-inner">
            <h1 className="wordmark">Sangam<span>IQ</span></h1>
            <p className="gate-tag">Real-time help for large gatherings. Prototype for Alandi, Pune - all places, people and crowd numbers are sample data.</p>
            <div className="roles">
              {ROLES.map(({ id, Icon, title, body }) => (
                <button key={id} className="role" onClick={() => choose(id)}>
                  <Icon size={30} /><b>{title}</b><span>{body}</span>
                </button>
              ))}
            </div>
            <p className="tiny muted">Tip: open Attendee in one browser window and Volunteer or Organiser in another to watch requests move live.</p>
          </div>
        </div>
      )}
    </AppProvider>
  );
}
