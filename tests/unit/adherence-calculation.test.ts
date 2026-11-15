import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { calculateAdherence } from '../../server/src/services/adherence.js';

test('Adherence Analytics Engine', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-adh-1', 'sub-adh', 'elder@test.local', 'Elder Test', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, created_at, updated_at)
    VALUES ('cp-adh-1', 'u-adh-1', 'Elder Profile', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO medications (id, care_profile_id, name, dose_text, form, schedule_type, schedule_config, start_date, created_by, updated_by, created_at, updated_at)
    VALUES ('m-adh-1', 'cp-adh-1', 'Test Med', '1 tab', 'Tablet', 'FIXED_TIMES', '{}', '2026-11-10', 'u-adh-1', 'u-adh-1', '2026-11-10T00:00:00Z', '2026-11-10T00:00:00Z')
  `).run();

  const now = new Date();
  const past1 = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
  const past2 = new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString();
  const future = new Date(now.getTime() + 2 * 24 * 3600 * 1000).toISOString();

  // Past dose 1: ACKNOWLEDGED_TAKEN
  db.prepare(`
    INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, idempotency_key, created_at, updated_at)
    VALUES ('d-p1', 'cp-adh-1', 'm-adh-1', ?, '2026-11-13T08:00:00', 'ACKNOWLEDGED_TAKEN', 'k-p1', ?, ?)
  `).run(past1, past1, past1);

  // Past dose 2: OVERDUE_UNCONFIRMED
  db.prepare(`
    INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, idempotency_key, created_at, updated_at)
    VALUES ('d-p2', 'cp-adh-1', 'm-adh-1', ?, '2026-11-14T08:00:00', 'OVERDUE_UNCONFIRMED', 'k-p2', ?, ?)
  `).run(past2, past2, past2);

  // Future dose: UPCOMING
  db.prepare(`
    INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, idempotency_key, created_at, updated_at)
    VALUES ('d-f1', 'cp-adh-1', 'm-adh-1', ?, '2026-11-17T08:00:00', 'UPCOMING', 'k-f1', ?, ?)
  `).run(future, future, future);

  await t.test('strictly excludes future doses and calculates accurate percentage', () => {
    const summary = calculateAdherence('cp-adh-1', 7);

    // Eligible doses should only be past doses (d-p1 and d-p2) = 2
    assert.equal(summary.metrics.totalEligiblePastDoses, 2);
    assert.equal(summary.metrics.acknowledgedTaken, 1);
    assert.equal(summary.metrics.overdueUnconfirmed, 1);

    // 1 taken out of 2 eligible = 50%
    assert.equal(summary.metrics.adherenceRatePercentage, 50);

    // Check methodology transparency disclaimer
    assert.ok(summary.methodology.definition.includes('Future doses are excluded'));
    assert.ok(summary.methodology.disclaimer.includes('not a clinical assessment'));
  });
});
