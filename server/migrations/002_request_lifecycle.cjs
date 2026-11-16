/**
 * Migration 002: Harden help-request lifecycle with timeline, auto-escalation,
 * ratings, and expanded statuses.
 */

exports.up = (pgm) => {
  pgm.sql(`
    -- Update status check constraint on help_requests
    ALTER TABLE help_requests DROP CONSTRAINT IF EXISTS help_requests_status_check;
    ALTER TABLE help_requests ADD CONSTRAINT help_requests_status_check
      CHECK (status IN ('open', 'accepted', 'on_the_way', 'arrived', 'completed', 'cancelled', 'escalated'));

    -- Add timeline, escalation, and feedback columns
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS escalation_round INT DEFAULT 0;
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS max_escalated BOOLEAN DEFAULT FALSE;
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS rating INT;
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS feedback TEXT;
    ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS help_requests_rating_idx ON help_requests (rating);
    CREATE INDEX IF NOT EXISTS help_requests_escalation_idx ON help_requests (escalation_round);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS help_requests_escalation_idx;
    DROP INDEX IF EXISTS help_requests_rating_idx;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS rated_at;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS feedback;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS rating;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS max_escalated;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS last_escalated_at;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS escalation_round;
    ALTER TABLE help_requests DROP COLUMN IF EXISTS timeline;
  `);
};
