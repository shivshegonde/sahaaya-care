import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { createCareNote, getCareNotesForProfile, generateHandoverSummary } from '../../server/src/services/careNotes.js';

test('Care Notes & 24h Handover Summary Engine', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-cn-1', 'sub-cn-1', 'anita@test.local', 'Anita Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-cn-2', 'sub-cn-2', 'ravi@test.local', 'Ravi Nurse', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-cn-1', 'u-cn-1', 'Anita Care', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  await t.test('creates care notes across distinct clinical categories and scopes', () => {
    const note1 = createCareNote({
      careProfileId: 'cp-cn-1',
      category: 'MEDICATION_OBSERVATION',
      body: 'Patient tolerated morning Metformin well without nausea.',
      visibility: 'ALL_MEMBERS',
      userId: 'u-cn-2'
    });

    assert.ok(note1.id);
    assert.equal(note1.category, 'MEDICATION_OBSERVATION');
    assert.equal(note1.visibility, 'ALL_MEMBERS');
    assert.equal(note1.author_name, 'Ravi Nurse');

    const note2 = createCareNote({
      careProfileId: 'cp-cn-1',
      category: 'FOLLOW_UP',
      body: 'Dr. Suresh requested BP readings to be recorded twice daily.',
      visibility: 'FAMILY_ONLY',
      userId: 'u-cn-1'
    });

    assert.ok(note2.id);
    assert.equal(note2.category, 'FOLLOW_UP');
    assert.equal(note2.visibility, 'FAMILY_ONLY');

    const list = getCareNotesForProfile('cp-cn-1');
    assert.equal(list.length, 2);
  });

  await t.test('generates comprehensive 24h handover summary with stats', () => {
    // Add a medication and doses
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const fourHoursAhead = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();

    db.prepare(`
      INSERT INTO medications (id, care_profile_id, name, dose_text, form, schedule_type, schedule_config, start_date, created_by, updated_by, created_at, updated_at)
      VALUES ('med-cn-1', 'cp-cn-1', 'Amlodipine', '5mg', 'Tablet', 'ONCE_DAILY', '{"times":["09:00"]}', '2026-11-15', 'u-cn-1', 'u-cn-1', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
    `).run();

    db.prepare(`
      INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, idempotency_key, acknowledged_at, acknowledged_by, created_at, updated_at)
      VALUES ('dose-cn-1', 'cp-cn-1', 'med-cn-1', ?, '09:00 AM', 'ACKNOWLEDGED_TAKEN', 'key-cn-1', ?, 'u-cn-1', ?, ?)
    `).run(twoHoursAgo, twoHoursAgo, twoHoursAgo, twoHoursAgo);

    db.prepare(`
      INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, idempotency_key, created_at, updated_at)
      VALUES ('dose-cn-2', 'cp-cn-1', 'med-cn-1', ?, '01:00 PM', 'UPCOMING', 'key-cn-2', ?, ?)
    `).run(fourHoursAhead, now.toISOString(), now.toISOString());

    const summary = generateHandoverSummary('cp-cn-1');
    assert.ok(summary);
    assert.ok(summary.generatedAt);
    assert.equal(summary.past24hStats.totalScheduled, 1);
    assert.equal(summary.past24hStats.takenCount, 1);
    assert.equal(summary.past24hStats.skippedCount, 0);
    assert.equal(summary.upcomingDosesSummary.length, 1);
    assert.equal(summary.recentNotes.length, 2);
  });
});
