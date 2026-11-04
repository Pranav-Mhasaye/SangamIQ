import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/sangamiq';

export const CENTER = { lat: 18.6764, lng: 73.8977 };

async function runSeed() {
  console.log('🌱 Starting SangamIQ database seed...');
  console.log(`📡 Connecting to: ${DATABASE_URL}`);

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('🐘 Connected to PostgreSQL successfully.');

    // Ensure PostGIS extension
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');

    // Truncate tables in dependency order
    await client.query(`
      TRUNCATE TABLE refresh_tokens, help_requests, alerts, crowd_samples, users, volunteers, services, crowd_zones CASCADE;
    `);
    console.log('🧹 Cleaned existing tables.');

    // 1. Seed Services
    const services = [
      { id: 'svc_101', type: 'medical', name: 'Primary Medical Camp', name_mr: 'प्राथमिक वैद्यकीय केंद्र', name_hi: 'प्राथमिक चिकित्सा शिविर', lat: 18.6779, lng: 73.8985, operator: 'District Health Dept.', services: ['First Aid', 'Doctor', 'Ambulance Support'] },
      { id: 'svc_102', type: 'medical', name: 'Ambulance Point - Palkhi Route', name_mr: 'रुग्णवाहिका केंद्र - पालखी मार्ग', name_hi: 'एम्बुलेंस पॉइंट - पालकी मार्ग', lat: 18.6745, lng: 73.896, operator: '108 Emergency Service', services: ['Ambulance', 'Oxygen'] },
      { id: 'svc_103', type: 'medical', name: 'Red Cross First Aid Tent', name_mr: 'रेड क्रॉस प्रथमोपचार तंबू', name_hi: 'रेड क्रॉस प्राथमिक उपचार तंबू', lat: 18.6791, lng: 73.9004, operator: 'Red Cross (volunteers)', hours: '6 AM - 11 PM', services: ['First Aid', 'ORS'] },
      { id: 'svc_104', type: 'water', name: 'Water Station - Ghat Steps', name_mr: 'पाणी केंद्र - घाट पायऱ्या', name_hi: 'जल सेवा - घाट सीढ़ियां', lat: 18.6758, lng: 73.8995, operator: 'Alandi Nagar Parishad', services: ['Drinking Water'] },
      { id: 'svc_105', type: 'water', name: 'Water Station - Mandir Road', name_mr: 'पाणी केंद्र - मंदिर रस्ता', name_hi: 'जल सेवा - मंदिर मार्ग', lat: 18.6785, lng: 73.896, operator: 'Seva Trust', services: ['Drinking Water', 'Buttermilk'] },
      { id: 'svc_106', type: 'water', name: 'Water Tanker - Bus Stand', name_mr: 'पाण्याचा टँकर - बस स्थानक', name_hi: 'पानी का टैंकर - बस स्टैंड', lat: 18.6738, lng: 73.8955, operator: 'Municipal Tanker', hours: '6 AM - 10 PM', services: ['Drinking Water'] },
      { id: 'svc_107', type: 'food', name: 'Food Seva - Annadan Mandap', name_mr: 'अन्नदान मंडप - भोजन सेवा', name_hi: 'अन्नदान मंडप - भोजन सेवा', lat: 18.675, lng: 73.8968, operator: 'Warkari Seva Mandal', hours: '7 AM - 10 PM', services: ['Free Meals', 'Prasad'] },
      { id: 'svc_108', type: 'food', name: 'Community Kitchen - College Road', name_mr: 'सामुदायिक अन्नछत्र - कॉलेज रस्ता', name_hi: 'सामुदायिक रसोई - कॉलेज रोड', lat: 18.677, lng: 73.901, operator: 'Local NGO', hours: '8 AM - 9 PM', services: ['Free Meals'] },
      { id: 'svc_109', type: 'toilet', name: 'Toilet Block A', name_mr: 'स्वच्छतागृह विभाग अ', name_hi: 'शौचालय ब्लॉक ए', lat: 18.6772, lng: 73.899, services: ['Toilets', 'Wash Area'] },
      { id: 'svc_110', type: 'toilet', name: 'Toilet Block B', name_mr: 'स्वच्छतागृह विभाग ब', name_hi: 'शौचालय ब्लॉक बी', lat: 18.674, lng: 73.8985, services: ['Toilets'] },
      { id: 'svc_111', type: 'toilet', name: 'Accessible Toilet - Mandir Gate', name_mr: 'सुलभ स्वच्छतागृह - मंदिर महाद्वार', name_hi: 'सुलभ शौचालय - मंदिर द्वार', lat: 18.679, lng: 73.8975, services: ['Accessible Toilets', 'Wheelchair Access'] },
      { id: 'svc_112', type: 'helpdesk', name: 'Help Desk - Main Gate', name_mr: 'मदत केंद्र - मुख्य प्रवेशद्वार', name_hi: 'सहायता केंद्र - मुख्य द्वार', lat: 18.6768, lng: 73.897, operator: 'Police + Volunteers', services: ['Information', 'Lost & Found', 'Family Reunion'] },
      { id: 'svc_113', type: 'helpdesk', name: 'Lost & Found - Ghat', name_mr: 'हरवले-सापडले केंद्र - घाट', name_hi: 'खोया-पाया केंद्र - घाट', lat: 18.6781, lng: 73.9, operator: 'Volunteers', services: ['Lost & Found', 'Announcements'] },
      { id: 'svc_114', type: 'transport', name: 'PMPML Shuttle Stop', name_mr: 'पीएमपीएमएल शटल थांबा', name_hi: 'पीएमपीएमएल शटल बस स्टॉप', lat: 18.6735, lng: 73.895, operator: 'PMPML', hours: '5 AM - 11 PM', services: ['Bus', 'Shuttle to Pune'] },
      { id: 'svc_115', type: 'transport', name: 'Free Pilgrim Shuttle', name_mr: 'मोफत वारकरी शटल', name_hi: 'मुफ्त तीर्थयात्री शटल', lat: 18.68, lng: 73.899, operator: 'Event Organisers', hours: '6 AM - 10 PM', services: ['Shuttle', 'Elderly Priority Seats'] },
    ];

    for (const s of services) {
      await client.query(
        `INSERT INTO services (id, type, name, name_mr, name_hi, operator, hours, services, verified, geom)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography);`,
        [s.id, s.type, s.name, s.name_mr, s.name_hi, s.operator || null, s.hours || '24 x 7', s.services || [], s.lat, s.lng]
      );
    }
    console.log(`✅ Seeded ${services.length} services.`);

    // 2. Seed Volunteers
    const volunteers = [
      { id: 'vol_101', name: 'Sneha Kulkarni', lat: 18.6769, lng: 73.8979, skills: ['medical', 'first-aid'], online: true, phone: '+91900000101' },
      { id: 'vol_102', name: 'Rahul Jadhav', lat: 18.6755, lng: 73.8972, skills: ['helpdesk', 'transport'], online: true, phone: '+91900000102' },
      { id: 'vol_103', name: 'Aarti Pawar', lat: 18.6781, lng: 73.8991, skills: ['medical', 'elderly-care'], online: true, phone: '+91900000103' },
      { id: 'vol_104', name: 'Omkar Shinde', lat: 18.6748, lng: 73.8998, skills: ['water', 'food'], online: true, phone: '+91900000104' },
      { id: 'vol_105', name: 'Prasad Deshpande', lat: 18.6762, lng: 73.9006, skills: ['helpdesk', 'toilet'], online: true, phone: '+91900000105' },
      { id: 'vol_106', name: 'Kavita More', lat: 18.6788, lng: 73.8967, skills: ['food', 'elderly-care'], online: true, phone: '+91900000106' },
      { id: 'vol_107', name: 'Sandeep Gaikwad', lat: 18.6742, lng: 73.8966, skills: ['transport', 'water'], online: true, phone: '+91900000107' },
      { id: 'vol_108', name: 'Neha Joshi', lat: 18.6775, lng: 73.8962, skills: ['medical', 'first-aid'], online: false, phone: '+91900000108' },
    ];

    for (const v of volunteers) {
      await client.query(
        `INSERT INTO volunteers (id, name, phone, skills, verified, status, online, geom)
         VALUES ($1, $2, $3, $4, true, 'approved', $5, ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography);`,
        [v.id, v.name, v.phone, v.skills, v.online, v.lat, v.lng]
      );
    }
    console.log(`✅ Seeded ${volunteers.length} approved volunteers.`);

    // 3. Seed Users
    const passwordHash = bcrypt.hashSync('admin123', 10);
    // Organiser account
    await client.query(
      `INSERT INTO users (id, phone, email, password_hash, role, name, created_at)
       VALUES ('usr_org_admin', null, 'admin@sangamiq.local', $1, 'organiser', 'Admin', now());`,
      [passwordHash]
    );

    // Volunteer accounts linked to volunteers
    for (let i = 0; i < volunteers.length; i++) {
      const v = volunteers[i];
      await client.query(
        `INSERT INTO users (id, phone, email, password_hash, role, name, volunteer_id, volunteer_status, created_at)
         VALUES ($1, $2, null, null, 'volunteer', $3, $4, 'approved', now());`,
        [`usr_vol_${i + 1}`, v.phone, v.name, v.id]
      );
    }
    console.log(`✅ Seeded organiser and volunteer users.`);

    // 4. Seed Crowd Zones
    const zones = [
      { id: 'z_mandir', name: 'Dnyaneshwar Mandir Gate', name_mr: 'ज्ञानेश्वर मंदिर महाद्वार', name_hi: 'ज्ञानेश्वर मंदिर मुख्य द्वार', lat: 18.6773, lng: 73.8978, radius: 120, capacity: 12000, base: 62 },
      { id: 'z_ghat', name: 'Indrayani Ghat', name_mr: 'इंद्रायणी घाट', name_hi: 'इंद्रायणी घाट', lat: 18.6779, lng: 73.8992, radius: 110, capacity: 8000, base: 48 },
      { id: 'z_road', name: 'Palkhi Main Road', name_mr: 'पालखी मुख्य मार्ग', name_hi: 'पालकी मुख्य मार्ग', lat: 18.6752, lng: 73.8962, radius: 150, capacity: 15000, base: 40 },
      { id: 'z_bus', name: 'Bus Stand & Shuttle Stop', name_mr: 'बस स्थानक व शटल थांबा', name_hi: 'बस स्टैंड और शटल स्टॉप', lat: 18.6737, lng: 73.8952, radius: 100, capacity: 6000, base: 35 },
      { id: 'z_mandap', name: 'Annadan Mandap', name_mr: 'अन्नदान मंडप', name_hi: 'अन्नदान मंडप', lat: 18.6751, lng: 73.8969, radius: 90, capacity: 4000, base: 55 },
    ];

    for (const z of zones) {
      await client.query(
        `INSERT INTO crowd_zones (id, name, name_mr, name_hi, capacity, radius, base, density, geom)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography);`,
        [z.id, z.name, z.name_mr, z.name_hi, z.capacity, z.radius, z.base, z.lat, z.lng]
      );
      // Seed a sample
      await client.query(
        `INSERT INTO crowd_samples (zone_id, density, at) VALUES ($1, $2, now());`,
        [z.id, z.base]
      );
    }
    console.log(`✅ Seeded ${zones.length} crowd zones with initial samples.`);

    // 5. Seed Alerts
    const alerts = [
      {
        id: 'alt_101', level: 'info', zone_id: null, title: 'Free shuttle running',
        messages: {
          en: 'Free pilgrim shuttle is running from Bus Stand to Mandir Gate every 15 minutes.',
          hi: 'बस स्टैंड से मंदिर गेट तक हर 15 मिनट में मुफ्त शटल चल रही है।',
          mr: 'बस स्थानक ते मंदिर गेट दरम्यान दर १५ मिनिटांनी मोफत शटल सुरू आहे.',
        },
      },
      {
        id: 'alt_102', level: 'warning', zone_id: 'z_ghat', title: 'Heavy rain expected',
        messages: {
          en: 'Rain expected in the evening. Keep to covered paths near the ghat steps.',
          hi: 'शाम को बारिश की संभावना है। घाट की सीढ़ियों के पास ढके रास्तों का उपयोग करें।',
          mr: 'संध्याकाळी पावसाची शक्यता आहे. घाटाच्या पायऱ्यांजवळ झाकलेल्या मार्गांचा वापर करा.',
        },
      },
    ];

    for (const a of alerts) {
      await client.query(
        `INSERT INTO alerts (id, level, zone_id, title, messages, auto, created_at)
         VALUES ($1, $2, $3, $4, $5, false, now());`,
        [a.id, a.level, a.zone_id, a.title, JSON.stringify(a.messages)]
      );
    }
    console.log(`✅ Seeded alerts.`);

    // 6. Seed Sample Help Requests
    const reqs = [
      { id: 'req_101', type: 'water', priority: 'normal', status: 'completed', channel: 'app', lat: CENTER.lat + 0.0004, lng: CENTER.lng - 0.0003, accepted_by: 'vol_104' },
      { id: 'req_102', type: 'medical', priority: 'high', status: 'completed', channel: 'app', lat: CENTER.lat - 0.0009, lng: CENTER.lng + 0.0011, accepted_by: 'vol_101' },
      { id: 'req_103', type: 'food', priority: 'normal', status: 'completed', channel: 'app', lat: CENTER.lat + 0.001, lng: CENTER.lng + 0.0021, accepted_by: 'vol_106' },
      { id: 'req_104', type: 'medical', priority: 'high', status: 'accepted', channel: 'app', lat: CENTER.lat + 0.0006, lng: CENTER.lng + 0.0008, accepted_by: 'vol_103' },
      { id: 'req_105', type: 'water', priority: 'normal', status: 'open', channel: 'app', lat: CENTER.lat - 0.0006, lng: CENTER.lng + 0.0005, accepted_by: null },
      { id: 'req_106', type: 'helpdesk', priority: 'normal', status: 'open', channel: 'voice', note: 'मदत हवी आहे', lat: CENTER.lat + 0.0011, lng: CENTER.lng - 0.0014, accepted_by: null },
    ];

    for (const r of reqs) {
      await client.query(
        `INSERT INTO help_requests (id, type, priority, status, channel, language, note, requester, accepted_by, geom, created_at, accepted_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, 'mr', $6, 'Attendee', $7, ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography, now() - interval '10 minutes',
                 CASE WHEN $4 IN ('accepted', 'completed') THEN now() - interval '8 minutes' ELSE null END,
                 CASE WHEN $4 = 'completed' THEN now() - interval '2 minutes' ELSE null END);`,
        [r.id, r.type, r.priority, r.status, r.channel, r.note || '', r.accepted_by, r.lat, r.lng]
      );
    }
    // Set active request for Aarti
    await client.query(`UPDATE volunteers SET active_request_id = 'req_104' WHERE id = 'vol_103';`);
    console.log(`✅ Seeded ${reqs.length} sample requests.`);

    console.log('\n✨ Database seeding completed successfully!\n');
  } catch (err) {
    console.error(`\n❌ Seeding failed: ${err.message}`);
    console.error('👉 Make sure PostgreSQL + PostGIS is running:');
    console.error('   docker compose up -d\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSeed();
