// In-memory store seeded with SAMPLE data around Alandi (Indrayani Ghat / Dnyaneshwar Mandir area).
// Swap this module for PostgreSQL/PostGIS later - the rest of the API only uses `db`.
import bcrypt from 'bcryptjs';

export const CENTER = { lat: 18.6764, lng: 73.8977, name: 'Alandi, Pune' };

export const TYPES = ['medical', 'water', 'food', 'toilet', 'helpdesk', 'transport'];

export const db = {
  services: [],
  volunteers: [],
  requests: [],
  alerts: [],
  zones: [],
  users: [],
  refreshTokens: [],
};

let counter = 100;
export const uid = (p) => `${p}_${++counter}`;

const S = (type, name, name_mr, name_hi, lat, lng, extra = {}) => ({
  id: uid('svc'), type, name, name_mr, name_hi, lat, lng, verified: true, hours: '24 x 7', ...extra,
});

export function seed() {
  counter = 100;
  const now = Date.now();
  const min = (m) => new Date(now - m * 60000).toISOString();

  db.services = [
    S('medical', 'Primary Medical Camp', 'प्राथमिक वैद्यकीय केंद्र', 'प्राथमिक चिकित्सा शिविर', 18.6779, 73.8985, { operator: 'District Health Dept.', services: ['First Aid', 'Doctor', 'Ambulance Support'] }),
    S('medical', 'Ambulance Point - Palkhi Route', 'रुग्णवाहिका केंद्र - पालखी मार्ग', 'एम्बुलेंस पॉइंट - पालकी मार्ग', 18.6745, 73.896, { operator: '108 Emergency Service', services: ['Ambulance', 'Oxygen'] }),
    S('medical', 'Red Cross First Aid Tent', 'रेड क्रॉस प्रथमोपचार तंबू', 'रेड क्रॉस प्राथमिक उपचार तंबू', 18.6791, 73.9004, { operator: 'Red Cross (volunteers)', hours: '6 AM - 11 PM', services: ['First Aid', 'ORS'] }),
    S('water', 'Water Station - Ghat Steps', 'पाणी केंद्र - घाट पायऱ्या', 'जल सेवा - घाट सीढ़ियां', 18.6758, 73.8995, { operator: 'Alandi Nagar Parishad', services: ['Drinking Water'] }),
    S('water', 'Water Station - Mandir Road', 'पाणी केंद्र - मंदिर रस्ता', 'जल सेवा - मंदिर मार्ग', 18.6785, 73.896, { operator: 'Seva Trust', services: ['Drinking Water', 'Buttermilk'] }),
    S('water', 'Water Tanker - Bus Stand', 'पाण्याचा टँकर - बस स्थानक', 'पानी का टैंकर - बस स्टैंड', 18.6738, 73.8955, { operator: 'Municipal Tanker', hours: '6 AM - 10 PM', services: ['Drinking Water'] }),
    S('food', 'Food Seva - Annadan Mandap', 'अन्नदान मंडप - भोजन सेवा', 'अन्नदान मंडप - भोजन सेवा', 18.675, 73.8968, { operator: 'Warkari Seva Mandal', hours: '7 AM - 10 PM', services: ['Free Meals', 'Prasad'] }),
    S('food', 'Community Kitchen - College Road', 'सामुदायिक अन्नछत्र - कॉलेज रस्ता', 'सामुदायिक रसोई - कॉलेज रोड', 18.677, 73.901, { operator: 'Local NGO', hours: '8 AM - 9 PM', services: ['Free Meals'] }),
    S('toilet', 'Toilet Block A', 'स्वच्छतागृह विभाग अ', 'शौचालय ब्लॉक ए', 18.6772, 73.899, { services: ['Toilets', 'Wash Area'] }),
    S('toilet', 'Toilet Block B', 'स्वच्छतागृह विभाग ब', 'शौचालय ब्लॉक बी', 18.674, 73.8985, { services: ['Toilets'] }),
    S('toilet', 'Accessible Toilet - Mandir Gate', 'सुलभ स्वच्छतागृह - मंदिर महाद्वार', 'सुलभ शौचालय - मंदिर द्वार', 18.679, 73.8975, { services: ['Accessible Toilets', 'Wheelchair Access'] }),
    S('helpdesk', 'Help Desk - Main Gate', 'मदत केंद्र - मुख्य प्रवेशद्वार', 'सहायता केंद्र - मुख्य द्वार', 18.6768, 73.897, { operator: 'Police + Volunteers', services: ['Information', 'Lost & Found', 'Family Reunion'] }),
    S('helpdesk', 'Lost & Found - Ghat', 'हरवले-सापडले केंद्र - घाट', 'खोया-पाया केंद्र - घाट', 18.6781, 73.9, { operator: 'Volunteers', services: ['Lost & Found', 'Announcements'] }),
    S('transport', 'PMPML Shuttle Stop', 'पीएमपीएमएल शटल थांबा', 'पीएमपीएमएल शटल बस स्टॉप', 18.6735, 73.895, { operator: 'PMPML', hours: '5 AM - 11 PM', services: ['Bus', 'Shuttle to Pune'] }),
    S('transport', 'Free Pilgrim Shuttle', 'मोफत वारकरी शटल', 'मुफ्त तीर्थयात्री शटल', 18.68, 73.899, { operator: 'Event Organisers', hours: '6 AM - 10 PM', services: ['Shuttle', 'Elderly Priority Seats'] }),
  ];

  const V = (name, lat, lng, skills, online = true) => ({
    id: uid('vol'), name, lat, lng, skills, online, verified: true, status: 'approved',
    phone: `+919000${String(counter).padStart(5, '0')}`, activeRequestId: null,
  });
  db.volunteers = [
    V('Sneha Kulkarni', 18.6769, 73.8979, ['medical', 'first-aid']),
    V('Rahul Jadhav', 18.6755, 73.8972, ['helpdesk', 'transport']),
    V('Aarti Pawar', 18.6781, 73.8991, ['medical', 'elderly-care']),
    V('Omkar Shinde', 18.6748, 73.8998, ['water', 'food']),
    V('Prasad Deshpande', 18.6762, 73.9006, ['helpdesk', 'toilet']),
    V('Kavita More', 18.6788, 73.8967, ['food', 'elderly-care']),
    V('Sandeep Gaikwad', 18.6742, 73.8966, ['transport', 'water']),
    V('Neha Joshi', 18.6775, 73.8962, ['medical', 'first-aid'], false),
  ];

  // ---------- Seed users ----------
  db.users = [];

  // Seeded organiser account (admin@sangamiq.local / admin123)
  const orgPasswordHash = bcrypt.hashSync('admin123', 10);
  db.users.push({
    id: uid('usr'), phone: null, email: 'admin@sangamiq.local', passwordHash: orgPasswordHash,
    role: 'organiser', name: 'Admin', createdAt: new Date().toISOString(),
    volunteerId: null, volunteerStatus: null,
  });

  // Link seeded volunteers to user accounts so they can log in with phone+OTP
  for (const vol of db.volunteers) {
    db.users.push({
      id: uid('usr'), phone: vol.phone, email: null, passwordHash: null,
      role: 'volunteer', name: vol.name, createdAt: new Date().toISOString(),
      volunteerId: vol.id, volunteerStatus: vol.status,
    });
  }

  db.refreshTokens = [];

  db.requests = [];
  const mk = (type, dLat, dLng, status, createdMin, acceptMin, vol, priority = 'normal', channel = 'app') => {
    const r = {
      id: uid('req'), type, lat: CENTER.lat + dLat, lng: CENTER.lng + dLng, status, priority,
      channel, language: 'mr', note: '', createdAt: min(createdMin), matched: [],
      acceptedBy: vol != null ? db.volunteers[vol].id : null,
      acceptedAt: acceptMin != null ? min(createdMin - acceptMin) : null,
      completedAt: status === 'completed' ? min(createdMin - (acceptMin ?? 1) - 6) : null,
    };
    db.requests.push(r);
    return r;
  };
  // sample requests so dashboards are not empty on first launch
  mk('water', 0.0004, -0.0003, 'completed', 95, 2, 3);
  mk('medical', -0.0009, 0.0011, 'completed', 80, 1, 0, 'high');
  mk('food', 0.001, 0.0021, 'completed', 70, 3, 5);
  mk('helpdesk', -0.0012, -0.0008, 'completed', 62, 2, 1, 'normal', 'voice');
  mk('toilet', 0.0016, 0.0003, 'completed', 55, 2, 4);
  mk('transport', -0.0022, -0.0027, 'completed', 41, 4, 6, 'normal', 'voice');
  const inProg = mk('medical', 0.0006, 0.0008, 'accepted', 9, 1, 2, 'high');
  db.volunteers[2].activeRequestId = inProg.id;
  mk('water', -0.0006, 0.0005, 'open', 3, null, null);
  mk('helpdesk', 0.0011, -0.0014, 'open', 2, null, null, 'normal', 'voice');
  mk('food', -0.0015, 0.0016, 'open', 1, null, null);

  db.alerts = [
    {
      id: uid('alt'), level: 'info', zone: null, createdAt: min(50), auto: false,
      title: 'Free shuttle running',
      messages: {
        en: 'Free pilgrim shuttle is running from Bus Stand to Mandir Gate every 15 minutes.',
        hi: 'बस स्टैंड से मंदिर गेट तक हर 15 मिनट में मुफ्त शटल चल रही है।',
        mr: 'बस स्थानक ते मंदिर गेट दरम्यान दर १५ मिनिटांनी मोफत शटल सुरू आहे.',
      },
    },
    {
      id: uid('alt'), level: 'warning', zone: 'z_ghat', createdAt: min(20), auto: false,
      title: 'Heavy rain expected',
      messages: {
        en: 'Rain expected in the evening. Keep to covered paths near the ghat steps.',
        hi: 'शाम को बारिश की संभावना है। घाट की सीढ़ियों के पास ढके रास्तों का उपयोग करें।',
        mr: 'संध्याकाळी पावसाची शक्यता आहे. घाटाच्या पायऱ्यांजवळ झाकलेल्या मार्गांचा वापर करा.',
      },
    },
  ];

  const Z = (id, name, name_mr, name_hi, lat, lng, radius, capacity, base) => ({
    id, name, name_mr, name_hi, lat, lng, radius, capacity, base, density: base, history: Array(6).fill(base), surge: 0, lastAlertAt: 0,
  });
  db.zones = [
    Z('z_mandir', 'Dnyaneshwar Mandir Gate', 'ज्ञानेश्वर मंदिर महाद्वार', 'ज्ञानेश्वर मंदिर मुख्य द्वार', 18.6773, 73.8978, 120, 12000, 62),
    Z('z_ghat', 'Indrayani Ghat', 'इंद्रायणी घाट', 'इंद्रायणी घाट', 18.6779, 73.8992, 110, 8000, 48),
    Z('z_road', 'Palkhi Main Road', 'पालखी मुख्य मार्ग', 'पालकी मुख्य मार्ग', 18.6752, 73.8962, 150, 15000, 40),
    Z('z_bus', 'Bus Stand & Shuttle Stop', 'बस स्थानक व शटल थांबा', 'बस स्टैंड और शटल स्टॉप', 18.6737, 73.8952, 100, 6000, 35),
    Z('z_mandap', 'Annadan Mandap', 'अन्नदान मंडप', 'अन्नदान मंडप', 18.6751, 73.8969, 90, 4000, 55),
  ];
}

seed();
