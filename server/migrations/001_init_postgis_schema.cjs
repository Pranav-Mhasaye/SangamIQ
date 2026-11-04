/**
 * PostgreSQL + PostGIS initial schema migration for SangamIQ.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS postgis;

    -- Services: locations of medical tents, water, food, toilets, helpdesks, transport
    CREATE TABLE IF NOT EXISTS services (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK (type IN ('medical','water','food','toilet','helpdesk','transport')),
      name        TEXT NOT NULL,
      name_mr     TEXT,
      name_hi     TEXT,
      operator    TEXT,
      hours       TEXT DEFAULT '24 x 7',
      services    TEXT[] DEFAULT '{}',
      verified    BOOLEAN DEFAULT FALSE,
      geom        GEOGRAPHY(Point, 4326) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS services_geom_idx ON services USING GIST (geom);
    CREATE INDEX IF NOT EXISTS services_type_idx ON services (type);

    -- Volunteers: verified volunteer network
    CREATE TABLE IF NOT EXISTS volunteers (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      phone             TEXT,
      skills            TEXT[] DEFAULT '{}',
      verified          BOOLEAN DEFAULT FALSE,
      status            TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
      online            BOOLEAN DEFAULT FALSE,
      active_request_id TEXT,
      geom              GEOGRAPHY(Point, 4326),
      updated_at        TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS volunteers_geom_idx ON volunteers USING GIST (geom);
    CREATE INDEX IF NOT EXISTS volunteers_status_idx ON volunteers (status);
    CREATE INDEX IF NOT EXISTS volunteers_online_idx ON volunteers (online);

    -- Users: authentication accounts for attendees, volunteers, and organisers
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      phone             TEXT,
      email             TEXT,
      password_hash     TEXT,
      role              TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee', 'volunteer', 'organiser', 'admin')),
      name              TEXT,
      volunteer_id      TEXT REFERENCES volunteers(id) ON DELETE SET NULL,
      volunteer_status  TEXT,
      created_at        TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS users_phone_idx ON users (phone);
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

    -- Refresh tokens for rotation
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens (expires_at);

    -- Help Requests: attendee assistance requests
    CREATE TABLE IF NOT EXISTS help_requests (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL CHECK (type IN ('medical','water','food','toilet','helpdesk','transport')),
      priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','critical')),
      status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','completed','cancelled')),
      channel       TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app','voice','ivr')),
      language      TEXT DEFAULT 'en',
      note          TEXT,
      requester     TEXT,
      user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
      device_id     TEXT,
      accepted_by   TEXT REFERENCES volunteers(id) ON DELETE SET NULL,
      geom          GEOGRAPHY(Point, 4326) NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT now(),
      accepted_at   TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS help_requests_geom_idx ON help_requests USING GIST (geom);
    CREATE INDEX IF NOT EXISTS help_requests_status_idx ON help_requests (status);
    CREATE INDEX IF NOT EXISTS help_requests_created_idx ON help_requests (created_at DESC);
    CREATE INDEX IF NOT EXISTS help_requests_priority_idx ON help_requests (priority);

    -- Crowd Zones: designated gathering zones
    CREATE TABLE IF NOT EXISTS crowd_zones (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      name_mr       TEXT,
      name_hi       TEXT,
      capacity      INT NOT NULL,
      radius        INT NOT NULL DEFAULT 100,
      base          INT NOT NULL DEFAULT 40,
      density       REAL NOT NULL DEFAULT 40,
      surge         INT NOT NULL DEFAULT 0,
      last_alert_at BIGINT NOT NULL DEFAULT 0,
      geom          GEOGRAPHY(Point, 4326) NOT NULL,
      boundary      GEOGRAPHY(Polygon, 4326)
    );
    CREATE INDEX IF NOT EXISTS crowd_zones_geom_idx ON crowd_zones USING GIST (geom);

    -- Crowd Samples: periodic density measurements
    CREATE TABLE IF NOT EXISTS crowd_samples (
      id        BIGSERIAL PRIMARY KEY,
      zone_id   TEXT NOT NULL REFERENCES crowd_zones(id) ON DELETE CASCADE,
      at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      density   REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS crowd_samples_zone_at_idx ON crowd_samples (zone_id, at DESC);

    -- Alerts: crowd and event advisories
    CREATE TABLE IF NOT EXISTS alerts (
      id          TEXT PRIMARY KEY,
      level       TEXT NOT NULL CHECK (level IN ('info','warning','emergency')),
      zone_id     TEXT REFERENCES crowd_zones(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      messages    JSONB NOT NULL,
      auto        BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts (created_at DESC);
    CREATE INDEX IF NOT EXISTS alerts_zone_idx ON alerts (zone_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS alerts CASCADE;
    DROP TABLE IF EXISTS crowd_samples CASCADE;
    DROP TABLE IF EXISTS crowd_zones CASCADE;
    DROP TABLE IF EXISTS help_requests CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS volunteers CASCADE;
    DROP TABLE IF EXISTS services CASCADE;
  `);
};
