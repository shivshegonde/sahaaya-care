import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { createAppointment, cancelAppointment, generateIcsCalendar } from '../../server/src/services/appointment.js';

test('Appointment Scheduling and RFC 5545 iCalendar Generator', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-apt-1', 'sub-apt-1', 'anita@test.local', 'Anita Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-apt-1', 'u-apt-1', 'Anita Care', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  let appointmentId: string;

  await t.test('creates appointment with valid metadata and audit entry', () => {
    const apt = createAppointment({
      careProfileId: 'cp-apt-1',
      doctorName: 'Suresh Kulkarni',
      specialty: 'Cardiologist',
      facilityName: 'Manipal Hospital',
      address: 'Old Airport Road, Bangalore',
      contactNumber: '+91 80 2502 4444',
      startsAtUtc: '2026-11-16T10:30:00.000Z',
      appointmentType: 'Routine Cardiac Follow-up',
      notes: 'Bring recent ECG report and blood pressure log.',
      userId: 'u-apt-1'
    });

    assert.ok(apt.id);
    assert.equal(apt.doctor_name, 'Suresh Kulkarni');
    assert.equal(apt.specialty, 'Cardiologist');
    assert.equal(apt.facility_name, 'Manipal Hospital');
    assert.equal(apt.status, 'SCHEDULED');
    appointmentId = apt.id;

    // Verify audit event
    const audit = db.prepare('SELECT * FROM audit_events WHERE entity_id = ?').get(apt.id) as any;
    assert.ok(audit);
    assert.equal(audit.action, 'APPOINTMENT_SCHEDULED');
  });

  await t.test('generates valid RFC 5545 iCalendar format for standard calendar import', () => {
    const ics = generateIcsCalendar(appointmentId);
    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('VERSION:2.0'));
    assert.ok(ics.includes('PRODID:-//Sahaaya Care//Appointment//EN'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes(`UID:apt-${appointmentId}@sahaayacare.local`));
    assert.ok(ics.includes('SUMMARY:Medical Appointment: Dr. Suresh Kulkarni (Cardiologist)'));
    assert.ok(ics.includes('LOCATION:Manipal Hospital, Old Airport Road, Bangalore'));
    assert.ok(ics.includes('DESCRIPTION:Bring recent ECG report and blood pressure log.'));
    assert.ok(ics.includes('STATUS:CONFIRMED'));
    assert.ok(ics.includes('END:VEVENT'));
    assert.ok(ics.includes('END:VCALENDAR'));
  });

  await t.test('cancelling appointment transitions status and records reason', () => {
    const updated = cancelAppointment(appointmentId, 'u-apt-1', 'Rescheduled to next month');
    assert.equal(updated.status, 'CANCELLED');

    const audit = db.prepare('SELECT * FROM audit_events WHERE entity_id = ? AND action = ?').get(appointmentId, 'APPOINTMENT_CANCELLED') as any;
    assert.ok(audit);
    assert.equal(audit.reason, 'Rescheduled to next month');
  });
});
