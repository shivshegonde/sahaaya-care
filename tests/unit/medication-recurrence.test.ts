import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { createMedication, generateDosesForMedication, getMedicationsForProfile, updateMedication, setMedicationStatus } from '../../server/src/services/medication.js';

test('Medication & Recurrence Engine', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  // Setup sample user and profile in memory
  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-test-01', 'sub-01', 'elder@test.local', 'Elder Test', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-test-01', 'u-test-01', 'Test Elder Profile', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  let createdMedId: string;

  await t.test('creates medication with exact prescribed dose text without alteration', () => {
    const med = createMedication({
      careProfileId: 'cp-test-01',
      name: 'Amlodipine 5mg',
      doseText: '1 tablet once daily in the morning',
      form: 'Tablet',
      scheduleType: 'FIXED_TIMES',
      scheduleConfig: { times: ['08:00'] },
      startDate: '2026-11-15',
      userId: 'u-test-01'
    });

    assert.ok(med);
    assert.equal(med.name, 'Amlodipine 5mg');
    assert.equal(med.dose_text, '1 tablet once daily in the morning');
    assert.equal(med.form, 'Tablet');
    assert.equal(med.version, 1);
    createdMedId = med.id;
  });

  await t.test('generates dose instances idempotently without duplicate insertions', () => {
    const meds = getMedicationsForProfile('cp-test-01');
    const med = meds[0];

    // Doses were already generated during createMedication
    const countBefore = db.prepare(`SELECT COUNT(*) as count FROM dose_instances WHERE medication_id = ?`).get(med.id) as any;
    assert.ok(countBefore.count >= 7);

    // Running generateDosesForMedication again should insert 0 duplicates
    const dosesSecondRun = generateDosesForMedication(med.id, '2026-11-15', 7);
    assert.equal(dosesSecondRun.length, 0);

    const countAfter = db.prepare(`SELECT COUNT(*) as count FROM dose_instances WHERE medication_id = ?`).get(med.id) as any;
    assert.equal(countAfter.count, countBefore.count);
  });

  await t.test('updating medication increments version and records audit event', () => {
    const updated = updateMedication(
      createdMedId,
      { doseText: '1 tablet (10mg) with warm water' },
      'u-test-01'
    );
    assert.equal(updated.dose_text, '1 tablet (10mg) with warm water');
    assert.equal(updated.version, 2);

    const audit = db.prepare('SELECT * FROM audit_events WHERE entity_id = ? AND action = ?').get(createdMedId, 'MEDICATION_UPDATED') as any;
    assert.ok(audit);
  });

  await t.test('pausing medication cancels upcoming future doses safely', () => {
    const paused = setMedicationStatus(createdMedId, 'PAUSED', 'u-test-01');
    assert.equal(paused.status, 'PAUSED');

    const upcomingCount = db.prepare(`SELECT COUNT(*) as count FROM dose_instances WHERE medication_id = ? AND status = 'UPCOMING'`).get(createdMedId) as any;
    assert.equal(upcomingCount.count, 0);

    const cancelledCount = db.prepare(`SELECT COUNT(*) as count FROM dose_instances WHERE medication_id = ? AND status = 'CANCELLED'`).get(createdMedId) as any;
    assert.ok(cancelledCount.count > 0);
  });
});
