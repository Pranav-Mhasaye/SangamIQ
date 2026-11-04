-- Target production schema (PostgreSQL + PostGIS). The prototype keeps the same shapes in memory (server/src/data.js).
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE services (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('medical','water','food','toilet','helpdesk','transport')),
  name        TEXT NOT NULL,
  operator    TEXT,
  hours       TEXT DEFAULT '24 x 7',
  services    TEXT[] DEFAULT '{}',
  verified    BOOLEAN DEFAULT FALSE,
  geom        GEOGRAPHY(Point, 4326) NOT NULL
);
CREATE INDEX services_geom_idx ON services USING GIST (geom);

CREATE TABLE volunteers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  skills      TEXT[] DEFAULT '{}',
  verified    BOOLEAN DEFAULT FALSE,
  online      BOOLEAN DEFAULT FALSE,
  geom        GEOGRAPHY(Point, 4326),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX volunteers_geom_idx ON volunteers USING GIST (geom);

CREATE TABLE help_requests (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','critical')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','completed','cancelled')),
  channel       TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app','voice','ivr')),
  language      TEXT DEFAULT 'en',
  note          TEXT,
  requester     TEXT,
  accepted_by   TEXT REFERENCES volunteers(id),
  geom          GEOGRAPHY(Point, 4326) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  accepted_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);
CREATE INDEX help_requests_geom_idx ON help_requests USING GIST (geom);

CREATE TABLE crowd_zones (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  capacity  INT NOT NULL,
  boundary  GEOGRAPHY(Polygon, 4326)
);
CREATE TABLE crowd_samples (
  zone_id    TEXT REFERENCES crowd_zones(id),
  at         TIMESTAMPTZ DEFAULT now(),
  density    REAL NOT NULL,           -- 0-100 % of capacity
  PRIMARY KEY (zone_id, at)
);

CREATE TABLE alerts (
  id          TEXT PRIMARY KEY,
  level       TEXT NOT NULL CHECK (level IN ('info','warning','emergency')),
  zone_id     TEXT REFERENCES crowd_zones(id),
  title       TEXT NOT NULL,
  messages    JSONB NOT NULL,         -- {"en": "...", "hi": "...", "mr": "..."}
  auto        BOOLEAN DEFAULT FALSE,  -- true when raised by the crowd forecast
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Example: nearest 3 online verified volunteers to a request (replaces matchVolunteers() in server/src/index.js)
-- SELECT id, name, ST_Distance(geom, $1::geography) AS meters
-- FROM volunteers WHERE online AND verified
-- ORDER BY geom <-> $1::geography LIMIT 3;
