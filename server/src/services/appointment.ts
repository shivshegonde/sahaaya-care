import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { recordAuditEvent } from './audit.js';

export interface AppointmentInput {
  careProfileId: string;
  doctorName: string;
  specialty?: string;
  facilityName: string;
  address?: string;
  contactNumber?: string;
  startsAtUtc: string; // ISO 8601
  timezone?: string;
  appointmentType?: string;
  notes?: string;
  userId: string;
}

export function createAppointment(input: AppointmentInput) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const timezone = input.timezone || 'Asia/Kolkata';

  db.prepare(`
    INSERT INTO appointments (
      id, care_profile_id, doctor_name, specialty, facility_name, address,
      contact_number, starts_at_utc, timezone, appointment_type, notes,
      status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?)
  `).run(
    id,
    input.careProfileId,
    input.doctorName.trim(),
    input.specialty?.trim() || null,
    input.facilityName.trim(),
    input.address?.trim() || null,
    input.contactNumber?.trim() || null,
    input.startsAtUtc,
    timezone,
    input.appointmentType || 'Consultation',
    input.notes?.trim() || null,
    input.userId,
    input.userId,
    now,
    now
  );

  recordAuditEvent({
    careProfileId: input.careProfileId,
    actorUserId: input.userId,
    action: 'APPOINTMENT_SCHEDULED',
    entityType: 'APPOINTMENT',
    entityId: id,
    afterSnapshot: {
      doctorName: input.doctorName,
      facilityName: input.facilityName,
      startsAtUtc: input.startsAtUtc
    },
    reason: `Scheduled appointment with Dr. ${input.doctorName}`
  });

  return getAppointmentById(id);
}

export function getAppointmentById(id: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(id) as any;
}

export function getAppointmentsForProfile(careProfileId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM appointments
    WHERE care_profile_id = ?
    ORDER BY starts_at_utc ASC
  `).all(careProfileId) as any[];
}

export function updateAppointment(id: string, updates: Partial<AppointmentInput>, actorUserId: string) {
  const db = getDb();
  const current = getAppointmentById(id);
  if (!current) throw new Error('Appointment not found');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE appointments
    SET doctor_name = COALESCE(?, doctor_name),
        specialty = COALESCE(?, specialty),
        facility_name = COALESCE(?, facility_name),
        address = COALESCE(?, address),
        contact_number = COALESCE(?, contact_number),
        starts_at_utc = COALESCE(?, starts_at_utc),
        notes = COALESCE(?, notes),
        updated_by = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    updates.doctorName?.trim() || null,
    updates.specialty?.trim() || null,
    updates.facilityName?.trim() || null,
    updates.address?.trim() || null,
    updates.contactNumber?.trim() || null,
    updates.startsAtUtc || null,
    updates.notes?.trim() || null,
    actorUserId,
    now,
    id
  );

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'APPOINTMENT_UPDATED',
    entityType: 'APPOINTMENT',
    entityId: id,
    beforeSnapshot: current,
    afterSnapshot: updates,
    reason: `Updated appointment details with Dr. ${current.doctor_name}`
  });

  return getAppointmentById(id);
}

export function cancelAppointment(id: string, actorUserId: string, reason?: string) {
  const db = getDb();
  const current = getAppointmentById(id);
  if (!current) throw new Error('Appointment not found');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE appointments
    SET status = 'CANCELLED', updated_by = ?, updated_at = ?
    WHERE id = ?
  `).run(actorUserId, now, id);

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'APPOINTMENT_CANCELLED',
    entityType: 'APPOINTMENT',
    entityId: id,
    reason: reason || 'Appointment cancelled by user'
  });

  return getAppointmentById(id);
}

// Generate standard RFC 5545 iCalendar (.ics) export
export function generateIcsCalendar(appointmentId: string): string {
  const apt = getAppointmentById(appointmentId);
  if (!apt) throw new Error('Appointment not found');

  const start = new Date(apt.starts_at_utc);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration default

  const formatIcsTime = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sahaaya Care//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:apt-${apt.id}@sahaayacare.local`,
    `DTSTAMP:${formatIcsTime(new Date())}`,
    `DTSTART:${formatIcsTime(start)}`,
    `DTEND:${formatIcsTime(end)}`,
    `SUMMARY:Medical Appointment: Dr. ${apt.doctor_name} (${apt.specialty || 'General'})`,
    `LOCATION:${apt.facility_name}${apt.address ? `, ${apt.address}` : ''}`,
    `DESCRIPTION:${apt.notes || 'Care coordination appointment recorded via Sahaaya Care'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
