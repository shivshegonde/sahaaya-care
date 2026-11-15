import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { sendEmail, getDeliveriesForProfile } from '../../server/src/services/email.js';
import { config } from '../../server/src/config.js';

test('Email Delivery & Notification Audit Log Engine', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  // Set provider to mock for deterministic test
  const originalProvider = config.emailProvider;
  config.emailProvider = 'mock';

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-em-1', 'sub-em-1', 'meera@test.local', 'Meera Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-em-1', 'u-em-1', 'Anita Care', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO notification_events (id, care_profile_id, event_type, entity_type, entity_id, scheduled_for, idempotency_key, created_at)
    VALUES ('ne-em-1', 'cp-em-1', 'ESCALATION', 'DOSE', 'dose-999', '2026-11-15T10:00:00Z', 'idemp-em-1', '2026-11-15T10:00:00Z')
  `).run();

  await t.test('records delivery entry in notification_deliveries table with mock provider', async () => {
    const result = await sendEmail({
      notificationEventId: 'ne-em-1',
      recipientUserId: 'u-em-1',
      toEmail: 'meera@test.local',
      toName: 'Meera Rao',
      subject: 'Care Check-in Notice: Anita Rao',
      bodyText: 'No acknowledgement was recorded for the morning medicine.'
    });

    assert.equal(result.status, 'SENT');
    assert.ok(result.providerMessageId);

    const deliveries = getDeliveriesForProfile('cp-em-1');
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].recipient_email, 'meera@test.local');
    assert.equal(deliveries[0].subject, 'Care Check-in Notice: Anita Rao');
    assert.equal(deliveries[0].event_type, 'ESCALATION');
  });

  // Restore config
  config.emailProvider = originalProvider;
});
