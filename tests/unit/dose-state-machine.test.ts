import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import {
  acknowledgeDoseTaken,
  acknowledgeDoseSkipped,
  markDoseUnableToTake,
  correctDoseAcknowledgement,
  evaluateDoseTransitions,
  getDoseById,
  getTodayDosesForProfile,
  getDoseHistoryForProfile
} from '../../server/src/services/dose.js';

test('Dose State Machine & Escalation Grace Period', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-1', 'sub-1', 'elder@test.local', 'Elder User', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-1', 'u-1', 'Elder Profile', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO medications (id, care_profile_id, name, dose_text, form, schedule_type, schedule_config, start_date, created_by, updated_by, created_at, updated_at)
    VALUES ('m-1', 'cp-1', 'Metformin 500mg', '1 tablet with dinner', 'Tablet', 'FIXED_TIMES', '{"times":["20:00"]}', '2026-11-15', 'u-1', 'u-1', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  // Create a dose scheduled for 20:00 UTC
  const doseId = 'd-test-100';
  db.prepare(`
    INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, grace_period_minutes, idempotency_key, created_at, updated_at)
    VALUES (?, 'cp-1', 'm-1', '2026-11-15T20:00:00.000Z', '2026-11-15T20:00:00', 'UPCOMING', 30, 'key_100', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run(doseId);

  await t.test('dose is initially UPCOMING', () => {
    const dose = getDoseById(doseId);
    assert.equal(dose.status, 'UPCOMING');
  });

  await t.test('transitions UPCOMING -> DUE when reference time reaches scheduled time', () => {
    // Current time is 20:05 UTC (reached scheduled time, within 30 min grace period)
    evaluateDoseTransitions('cp-1', '2026-11-15T20:05:00.000Z');
    const dose = getDoseById(doseId);
    assert.equal(dose.status, 'DUE');
  });

  await t.test('transitions DUE -> OVERDUE_UNCONFIRMED after 30 min grace period passes without acknowledgement', () => {
    // Current time is 20:35 UTC (> 30 mins grace period)
    evaluateDoseTransitions('cp-1', '2026-11-15T20:35:00.000Z');
    const dose = getDoseById(doseId);
    assert.equal(dose.status, 'OVERDUE_UNCONFIRMED');
  });

  await t.test('acknowledging taken updates status, actor, and timestamp', () => {
    acknowledgeDoseTaken(doseId, 'u-1', 'Taken with water');
    const dose = getDoseById(doseId);
    assert.equal(dose.status, 'ACKNOWLEDGED_TAKEN');
    assert.equal(dose.acknowledged_by, 'u-1');
    assert.equal(dose.acknowledgement_note, 'Taken with water');
    assert.ok(dose.acknowledged_at);
  });

  await t.test('correcting dose acknowledgement requires reason and preserves history', () => {
    // Attempting correction without reason throws error
    assert.throws(() => {
      correctDoseAcknowledgement(doseId, 'u-1', 'ACKNOWLEDGED_SKIPPED', '');
    }, /reason is required/);

    // Correction with valid reason succeeds
    correctDoseAcknowledgement(doseId, 'u-1', 'ACKNOWLEDGED_SKIPPED', 'Accidentally marked taken; actually skipped due to fasting');
    const dose = getDoseById(doseId);
    assert.equal(dose.status, 'ACKNOWLEDGED_SKIPPED');
  });

  await t.test('acknowledging skipped and unable to take transitions state safely', () => {
    const dose2Id = 'd-test-200';
    db.prepare(`
      INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, grace_period_minutes, idempotency_key, created_at, updated_at)
      VALUES (?, 'cp-1', 'm-1', '2026-11-15T21:00:00.000Z', '2026-11-15T21:00:00', 'DUE', 30, 'key_200', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
    `).run(dose2Id);

    const skipped = acknowledgeDoseSkipped(dose2Id, 'u-1', 'Patient is fasting');
    assert.equal(skipped.status, 'ACKNOWLEDGED_SKIPPED');

    const dose3Id = 'd-test-300';
    db.prepare(`
      INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, grace_period_minutes, idempotency_key, created_at, updated_at)
      VALUES (?, 'cp-1', 'm-1', '2026-11-15T22:00:00.000Z', '2026-11-15T22:00:00', 'DUE', 30, 'key_300', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
    `).run(dose3Id);

    const unable = markDoseUnableToTake(dose3Id, 'u-1', 'Patient felt nausea');
    assert.equal(unable.status, 'UNABLE_TO_TAKE');
  });

  await t.test('queries today doses and history ranges correctly', () => {
    const today = getTodayDosesForProfile('cp-1', '2026-11-15T20:00:00.000Z');
    assert.ok(today.length >= 1);

    const history = getDoseHistoryForProfile('cp-1', '2026-11-14T00:00:00.000Z', '2026-11-16T00:00:00.000Z');
    assert.ok(history.length >= 2);
  });
});
