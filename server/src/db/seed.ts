import crypto from 'node:crypto';
import { getDb } from './database.js';
import { hashPassword } from '../services/auth.js';
import { DEFAULT_ROLE_SCOPES } from '../services/rbac.js';
import { createMedication, generateDosesForMedication } from '../services/medication.js';
import { createAppointment } from '../services/appointment.js';
import { createCareNote } from '../services/careNotes.js';
import { createInvitation } from '../services/invitation.js';

export function runSeed(dbPath?: string) {
  const db = getDb(dbPath);
  console.log('Seeding demo data into Sahaaya Care...');

  // Clean existing data for clean idempotent seed
  db.exec(`
    DELETE FROM assistant_actions;
    DELETE FROM outbox_events;
    DELETE FROM notification_deliveries;
    DELETE FROM notification_events;
    DELETE FROM audit_events;
    DELETE FROM care_notes;
    DELETE FROM appointments;
    DELETE FROM dose_instances;
    DELETE FROM medications;
    DELETE FROM invitations;
    DELETE FROM care_memberships;
    DELETE FROM care_profiles;
    DELETE FROM users;
  `);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const demoPassHash = hashPassword('DemoPass123!');

  // 1. Create Users
  const elderId = 'u-anita-rao-01';
  const familyId = 'u-meera-rao-02';
  const caretakerId = 'u-ravi-patil-03';

  const userInsert = db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, preferred_language, role_title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  userInsert.run(elderId, `email|${elderId}`, 'anita.rao@example.com', 'Anita Rao', demoPassHash, 'en', 'Elderly Mother', now.toISOString(), now.toISOString());
  userInsert.run(familyId, `email|${familyId}`, 'meera.rao@example.com', 'Meera Rao', demoPassHash, 'en', 'Daughter (Family Admin)', now.toISOString(), now.toISOString());
  userInsert.run(caretakerId, `email|${caretakerId}`, 'ravi.patil@example.com', 'Ravi Patil', demoPassHash, 'en', 'Home Care Assistant', now.toISOString(), now.toISOString());

  // 2. Create Care Profile for Anita Rao
  const profileId = 'cp-anita-rao-01';
  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, preferred_language, grace_period_minutes, created_at, updated_at)
    VALUES (?, ?, ?, 'Asia/Kolkata', 'en', 30, ?, ?)
  `).run(profileId, elderId, 'Anita Rao', now.toISOString(), now.toISOString());

  // 3. Establish Care Memberships
  const memberInsert = db.prepare(`
    INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
  `);

  memberInsert.run('cm-01', profileId, elderId, 'ELDER_OWNER', JSON.stringify(DEFAULT_ROLE_SCOPES.ELDER_OWNER), now.toISOString());
  memberInsert.run('cm-02', profileId, familyId, 'FAMILY_ADMIN', JSON.stringify(DEFAULT_ROLE_SCOPES.FAMILY_ADMIN), now.toISOString());
  memberInsert.run('cm-03', profileId, caretakerId, 'CARETAKER', JSON.stringify(DEFAULT_ROLE_SCOPES.CARETAKER), now.toISOString());

  // 4. Create Sample Medications
  const med1 = createMedication({
    careProfileId: profileId,
    name: 'Amlodipine 5mg',
    brandName: 'Norvasc',
    doseText: '1 tablet once daily with water after breakfast',
    form: 'Tablet',
    route: 'Oral',
    instructions: 'Take in the morning with a full glass of water after breakfast',
    scheduleType: 'FIXED_TIMES',
    scheduleConfig: { times: ['08:00'] },
    startDate: todayStr,
    prescriber: 'Dr. Suresh Kulkarni (Cardiology)',
    userId: elderId
  });

  const med2 = createMedication({
    careProfileId: profileId,
    name: 'Metformin 500mg',
    brandName: 'Glucophage',
    doseText: '1 tablet twice daily with meals (Lunch and Dinner)',
    form: 'Tablet',
    route: 'Oral',
    instructions: 'Take with or immediately after lunch and dinner to avoid stomach upset',
    scheduleType: 'FIXED_TIMES',
    scheduleConfig: { times: ['13:00', '20:30'] },
    startDate: todayStr,
    prescriber: 'Dr. Ramesh Deshmukh (Diabetology)',
    userId: elderId
  });

  const med3 = createMedication({
    careProfileId: profileId,
    name: 'Atorvastatin 20mg',
    brandName: 'Lipitor',
    doseText: '1 tablet once daily at bedtime',
    form: 'Tablet',
    route: 'Oral',
    instructions: 'Take at night before going to sleep',
    scheduleType: 'FIXED_TIMES',
    scheduleConfig: { times: ['21:30'] },
    startDate: todayStr,
    prescriber: 'Dr. Suresh Kulkarni (Cardiology)',
    userId: elderId
  });

  // Generate doses
  generateDosesForMedication(med1!.id, todayStr, 7);
  generateDosesForMedication(med2!.id, todayStr, 7);
  generateDosesForMedication(med3!.id, todayStr, 7);

  // 5. Simulate dose acknowledgement states for Today
  // Find morning 08:00 dose of Amlodipine -> Mark as ACKNOWLEDGED_TAKEN
  const amlodipineMorningDose = db.prepare(`
    SELECT id FROM dose_instances
    WHERE medication_id = ? AND scheduled_at_utc LIKE ?
    LIMIT 1
  `).get(med1!.id, `%${todayStr}%`) as any;

  if (amlodipineMorningDose) {
    db.prepare(`
      UPDATE dose_instances
      SET status = 'ACKNOWLEDGED_TAKEN',
          acknowledged_at = ?,
          acknowledged_by = ?,
          acknowledgement_note = 'Taken with breakfast'
      WHERE id = ?
    `).run(now.toISOString(), elderId, amlodipineMorningDose.id);
  }

  // Find lunch 13:00 dose of Metformin -> Mark as OVERDUE_UNCONFIRMED to demo escalation
  const metforminLunchDose = db.prepare(`
    SELECT id FROM dose_instances
    WHERE medication_id = ? AND scheduled_at_utc LIKE ?
    ORDER BY scheduled_at_utc ASC LIMIT 1
  `).get(med2!.id, `%${todayStr}%`) as any;

  if (metforminLunchDose) {
    db.prepare(`
      UPDATE dose_instances
      SET status = 'OVERDUE_UNCONFIRMED'
      WHERE id = ?
    `).run(metforminLunchDose.id);

    // Create an escalation notification event and delivery to demonstrate in UI
    const eventId = 'ne-demo-escalation-01';
    db.prepare(`
      INSERT INTO notification_events (id, care_profile_id, event_type, entity_type, entity_id, scheduled_for, idempotency_key, status, created_at)
      VALUES (?, ?, 'DOSE_OVERDUE_UNCONFIRMED', 'DOSE', ?, ?, 'demo_escalation_key_01', 'PROCESSED', ?)
    `).run(eventId, profileId, metforminLunchDose.id, now.toISOString(), now.toISOString());

    db.prepare(`
      INSERT INTO notification_deliveries (
        id, notification_event_id, recipient_user_id, recipient_email, recipient_name,
        channel, provider, subject, body_text, provider_message_id, status, attempt_count,
        sent_at, delivered_at, metadata, created_at
      ) VALUES (?, ?, ?, 'meera.rao@example.com', 'Meera Rao', 'EMAIL', 'mock-sandbox', ?, ?, 'msg_demo_01', 'SENT', 1, ?, ?, '{}', ?)
    `).run(
      'del-demo-01',
      eventId,
      familyId,
      'Sahaaya Care Alert: Dose check-in for Anita Rao',
      `Hello Meera Rao,\n\nThis is a care coordination check-in alert. No acknowledgement was recorded for Anita Rao's scheduled dose of Metformin 500mg within the 30-minute grace period.\n\nPlease check in with your mother to confirm her routine.\n\nSahaaya Care Coordination`,
      now.toISOString(),
      now.toISOString(),
      now.toISOString()
    );
  }

  // 6. Create Upcoming Doctor Appointment
  const aptDate = new Date(now.getTime() + 3 * 24 * 3600 * 1000); // 3 days ahead
  createAppointment({
    careProfileId: profileId,
    doctorName: 'Suresh Kulkarni',
    specialty: 'Cardiology',
    facilityName: 'Apollo Specialty Clinic, Bangalore',
    address: '14th Cross, Malleshwaram, Bengaluru, Karnataka 560003',
    contactNumber: '+91 98450 12345',
    startsAtUtc: aptDate.toISOString(),
    appointmentType: 'Quarterly Cardiology Review',
    notes: 'Bring recent blood pressure log and fasting blood sugar reports.',
    userId: elderId
  });

  // 7. Create Care Notes
  createCareNote({
    careProfileId: profileId,
    category: 'GENERAL',
    body: 'Morning routine went smoothly today. Anita completed 20 minutes of mild stretching and breakfast on time.',
    visibility: 'ALL_MEMBERS',
    userId: caretakerId
  });

  createCareNote({
    careProfileId: profileId,
    category: 'MEDICATION_OBSERVATION',
    body: 'Blood pressure checked after morning dose: 122/80 mmHg. Pulse: 72 bpm. Normal range.',
    visibility: 'ALL_MEMBERS',
    userId: caretakerId
  });

  // 8. Create a sample pending invitation
  createInvitation({
    careProfileId: profileId,
    email: 'dr.deshmukh@example.com',
    role: 'CARE_COORDINATOR',
    createdByUserId: elderId,
    expiresInHours: 72
  });

  console.log('Demo seed completed successfully!');
  console.log('Demo Accounts:');
  console.log('  1. Anita Rao (Elder Owner):   anita.rao@example.com   / DemoPass123!');
  console.log('  2. Meera Rao (Family Admin):  meera.rao@example.com   / DemoPass123!');
  console.log('  3. Ravi Patil (Caretaker):    ravi.patil@example.com  / DemoPass123!');
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed();
}
