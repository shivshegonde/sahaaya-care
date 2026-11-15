-- Sahaaya Care Relational Schema (SQLite & PostgreSQL Compatible)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'en',
  role_title TEXT DEFAULT 'Family',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS care_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  preferred_language TEXT DEFAULT 'en',
  grace_period_minutes INTEGER DEFAULT 30,
  notification_preferences TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS care_memberships (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- ELDER_OWNER, FAMILY_ADMIN, FAMILY_MEMBER, CARETAKER, CARE_COORDINATOR
  permissions TEXT NOT NULL, -- JSON array of granted permission scopes
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, REVOKED
  invited_by TEXT REFERENCES users(id),
  accepted_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(care_profile_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  permission_scopes TEXT NOT NULL, -- JSON array
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_name TEXT,
  dose_text TEXT NOT NULL, -- Exact user/caregiver entered instructions
  form TEXT NOT NULL, -- Tablet, Capsule, Liquid, Inhaler, Drops, Injection
  route TEXT DEFAULT 'Oral',
  instructions TEXT, -- e.g. "After food with a glass of water"
  schedule_type TEXT NOT NULL, -- FIXED_TIMES, ONCE_DAILY, WEEKDAYS, INTERVAL
  schedule_config TEXT NOT NULL, -- JSON: { times: ["08:00", "20:00"], days?: ["monday"] }
  start_date TEXT NOT NULL,
  end_date TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, ARCHIVED
  prescriber TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dose_instances (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_at_utc TEXT NOT NULL,
  local_scheduled_at TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  status TEXT DEFAULT 'UPCOMING', -- UPCOMING, DUE, ACKNOWLEDGED_TAKEN, ACKNOWLEDGED_SKIPPED, UNABLE_TO_TAKE, OVERDUE_UNCONFIRMED, CANCELLED
  grace_period_minutes INTEGER DEFAULT 30,
  acknowledged_at TEXT,
  acknowledged_by TEXT REFERENCES users(id),
  acknowledgement_note TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dose_profile_time ON dose_instances(care_profile_id, scheduled_at_utc, status);
CREATE INDEX IF NOT EXISTS idx_doses_profile_status_time ON dose_instances(care_profile_id, status, scheduled_at_utc);
CREATE INDEX IF NOT EXISTS idx_medications_profile_status ON medications(care_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_user_profile ON care_memberships(user_id, care_profile_id);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  doctor_name TEXT NOT NULL,
  specialty TEXT,
  facility_name TEXT NOT NULL,
  address TEXT,
  contact_number TEXT,
  starts_at_utc TEXT NOT NULL,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  appointment_type TEXT DEFAULT 'In-person checkup',
  notes TEXT,
  status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_profile_time ON appointments(care_profile_id, starts_at_utc, status);

CREATE TABLE IF NOT EXISTS care_notes (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT DEFAULT 'GENERAL', -- GENERAL, APPOINTMENT, MEDICATION_OBSERVATION, FOLLOW_UP
  body TEXT NOT NULL,
  visibility TEXT DEFAULT 'ALL_MEMBERS', -- ALL_MEMBERS, FAMILY_ONLY, CARETAKER_ONLY
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_notes_profile ON care_notes(care_profile_id, created_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT DEFAULT 'EMAIL',
  enabled INTEGER DEFAULT 1,
  quiet_hours TEXT DEFAULT '{"enabled": false, "start": "22:00", "end": "07:00"}',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  UNIQUE(care_profile_id, user_id, event_type, channel)
);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- DOSE_DUE, DOSE_OVERDUE_UNCONFIRMED, ESCALATION, APPOINTMENT_REMINDER, CARE_UPDATE
  entity_type TEXT NOT NULL, -- DOSE, APPOINTMENT, NOTE, INVITATION
  entity_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSED, ESCALATED
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_event_id TEXT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  recipient_user_id TEXT REFERENCES users(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  channel TEXT DEFAULT 'EMAIL',
  provider TEXT DEFAULT 'mock',
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT DEFAULT 'QUEUED', -- QUEUED, SENT, DELIVERED, RETRYING, FAILED, CANCELLED
  attempt_count INTEGER DEFAULT 0,
  last_error_code TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, -- MEDICATION_CREATE, DOSE_ACKNOWLEDGE, MEMBER_INVITE, etc.
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_snapshot TEXT, -- JSON
  after_snapshot TEXT, -- JSON
  reason TEXT,
  correlation_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_profile_created ON audit_events(care_profile_id, created_at);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  attempt_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_published ON outbox_events(published_at, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(published_at, attempt_count);
CREATE INDEX IF NOT EXISTS idx_deliveries_event_status ON notification_deliveries(notification_event_id, status);

CREATE TABLE IF NOT EXISTS assistant_actions (
  id TEXT PRIMARY KEY,
  care_profile_id TEXT NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL, -- PROPOSE_MEDICATION_CHANGE, PROPOSE_APPOINTMENT_CHANGE, CREATE_CARE_NOTE, REQUEST_HUMAN_HELP
  summary TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON proposed change details
  status TEXT DEFAULT 'PROPOSED', -- PROPOSED, CONFIRMED, REJECTED, EXECUTED
  created_at TEXT NOT NULL,
  executed_at TEXT
);
