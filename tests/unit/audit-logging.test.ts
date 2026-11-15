import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { recordAuditEvent, getAuditEvents } from '../../server/src/services/audit.js';

test('Audit Trail & Compliance Logging', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-aud-1', 'sub-aud-1', 'meera@test.local', 'Meera Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-aud-1', 'u-aud-1', 'Anita Care', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  await t.test('records structured audit entry with before/after snapshots and correlation id', () => {
    const eventId = recordAuditEvent({
      careProfileId: 'cp-aud-1',
      actorUserId: 'u-aud-1',
      action: 'MEDICATION_UPDATED',
      entityType: 'MEDICATION',
      entityId: 'med-999',
      beforeSnapshot: { doseText: '5mg' },
      afterSnapshot: { doseText: '10mg' },
      reason: 'Doctor increased dosage after review',
      correlationId: 'req-corr-123'
    });

    assert.ok(eventId);

    const events = getAuditEvents('cp-aud-1');
    assert.equal(events.length, 1);
    assert.equal(events[0].action, 'MEDICATION_UPDATED');
    assert.equal(events[0].actor_name, 'Meera Rao');
    assert.deepEqual(events[0].before_snapshot, { doseText: '5mg' });
    assert.deepEqual(events[0].after_snapshot, { doseText: '10mg' });
    assert.equal(events[0].reason, 'Doctor increased dosage after review');
    assert.equal(events[0].correlation_id, 'req-corr-123');
  });

  await t.test('supports pagination via limit and offset', () => {
    for (let i = 0; i < 5; i++) {
      recordAuditEvent({
        careProfileId: 'cp-aud-1',
        actorUserId: 'u-aud-1',
        action: `EVENT_${i}`,
        entityType: 'DOSE',
        entityId: `dose-${i}`
      });
    }

    const page1 = getAuditEvents('cp-aud-1', 3, 0);
    assert.equal(page1.length, 3);

    const page2 = getAuditEvents('cp-aud-1', 3, 3);
    assert.equal(page2.length, 3);
  });
});
