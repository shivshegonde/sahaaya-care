import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { dispatchNotification } from '../../server/src/services/notification.js';
import { config } from '../../server/src/config.js';

test('Transactional Outbox & Multi-Tier Escalation Pipeline', async (t) => {
  const originalProvider = config.emailProvider;
  config.emailProvider = 'mock'; // Fast, offline unit test isolation
  t.after(() => {
    config.emailProvider = originalProvider;
  });

  const db = getDb(':memory:');
  setDb(db);

  // Setup Elder, Family Admin, and Caretaker
  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES 
      ('u-elder', 'sub-1', 'anita@test.local', 'Anita Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z'),
      ('u-family', 'sub-2', 'meera@test.local', 'Meera Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, grace_period_minutes, created_at, updated_at)
    VALUES ('cp-outbox-1', 'u-elder', 'Anita Care', 'Asia/Kolkata', 30, '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
    VALUES 
      ('cm-1', 'cp-outbox-1', 'u-elder', 'ELDER_OWNER', '["ALL"]', 'ACTIVE', '2026-11-15T00:00:00Z'),
      ('cm-2', 'cp-outbox-1', 'u-family', 'FAMILY_ADMIN', '["VIEW"]', 'ACTIVE', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO medications (id, care_profile_id, name, dose_text, form, schedule_type, schedule_config, start_date, created_by, updated_by, created_at, updated_at)
    VALUES ('m-outbox-1', 'cp-outbox-1', 'Amlodipine 5mg', '1 tablet in the morning', 'Tablet', 'DAILY', '{}', '2026-11-15', 'u-elder', 'u-elder', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO dose_instances (id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at, status, grace_period_minutes, idempotency_key, created_at, updated_at)
    VALUES ('d-outbox-1', 'cp-outbox-1', 'm-outbox-1', '2026-11-15T08:00:00Z', '2026-11-15 08:00', 'OVERDUE_UNCONFIRMED', 30, 'key-outbox-1', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  await t.test('dispatches escalation notice with safe clinical phrasing to family contact', async () => {
    const result = await dispatchNotification({
      careProfileId: 'cp-outbox-1',
      eventType: 'DOSE_OVERDUE_UNCONFIRMED',
      entityType: 'DOSE',
      entityId: 'd-outbox-1',
      scheduledFor: '2026-11-15T08:00:00Z'
    });

    assert.equal(result.status, 'PROCESSED');

    // Verify email deliveries were recorded in notification_deliveries
    const deliveries = db.prepare(`SELECT * FROM notification_deliveries`).all() as any[];
    assert.ok(deliveries.length >= 2); // One to elder, one to family contact

    const familyDelivery = deliveries.find(d => d.recipient_email === 'meera@test.local');
    assert.ok(familyDelivery);
    assert.equal(familyDelivery.status, 'SENT');
    assert.ok(familyDelivery.body_text.includes('No acknowledgement was recorded'));
  });

  await t.test('idempotency key prevents duplicate email notifications', async () => {
    // Re-dispatching same parameters should be safely rejected as ALREADY_PROCESSED
    const duplicateResult = await dispatchNotification({
      careProfileId: 'cp-outbox-1',
      eventType: 'DOSE_OVERDUE_UNCONFIRMED',
      entityType: 'DOSE',
      entityId: 'd-outbox-1',
      scheduledFor: '2026-11-15T08:00:00Z'
    });

    assert.equal(duplicateResult.status, 'ALREADY_PROCESSED');
  });
});
