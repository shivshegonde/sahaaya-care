import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { sendEmail } from './email.js';
import { recordAuditEvent } from './audit.js';

export interface NotificationDispatchParams {
  careProfileId: string;
  eventType: 'DOSE_DUE' | 'DOSE_OVERDUE_UNCONFIRMED' | 'APPOINTMENT_REMINDER' | 'CARE_UPDATE';
  entityType: 'DOSE' | 'APPOINTMENT' | 'NOTE' | 'INVITATION';
  entityId: string;
  scheduledFor: string;
  metadata?: Record<string, any>;
}

export async function dispatchNotification(params: NotificationDispatchParams) {
  const db = getDb();
  const idempotencyKey = `${params.careProfileId}_${params.entityType}_${params.entityId}_${params.eventType}_${params.scheduledFor}`;

  // Check if notification event already exists (Idempotency)
  let event = db.prepare(`SELECT * FROM notification_events WHERE idempotency_key = ?`).get(idempotencyKey) as any;

  if (!event) {
    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notification_events (
        id, care_profile_id, event_type, entity_type, entity_id, scheduled_for,
        idempotency_key, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      eventId,
      params.careProfileId,
      params.eventType,
      params.entityType,
      params.entityId,
      params.scheduledFor,
      idempotencyKey,
      now
    );
    event = { id: eventId, ...params, status: 'PENDING' };
  } else if (event.status === 'PROCESSED' || event.status === 'ESCALATED') {
    // Idempotent: already handled, no duplicate emails
    return { eventId: event.id, status: 'ALREADY_PROCESSED' };
  }

  // Fetch care profile and owner
  const profile = db.prepare(`
    SELECT cp.*, u.email as owner_email, u.display_name as owner_name
    FROM care_profiles cp
    JOIN users u ON cp.owner_user_id = u.id
    WHERE cp.id = ?
  `).get(params.careProfileId) as any;

  if (!profile) return { error: 'Care profile not found' };

  // Fetch active memberships
  const members = db.prepare(`
    SELECT cm.*, u.email, u.display_name
    FROM care_memberships cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.care_profile_id = ? AND cm.status = 'ACTIVE'
  `).all(params.careProfileId) as any[];

  // Execute Escalation / Dispatch Policy
  if (params.eventType === 'DOSE_DUE') {
    // Fetch dose details
    const dose = db.prepare(`
      SELECT d.*, m.name as medication_name, m.instructions, m.dose_text
      FROM dose_instances d
      JOIN medications m ON d.medication_id = m.id
      WHERE d.id = ?
    `).get(params.entityId) as any;

    if (dose && (dose.status === 'DUE' || dose.status === 'UPCOMING')) {
      const subject = `Sahaaya Care: Medication Reminder for ${dose.medication_name}`;
      const body = `Hello ${profile.display_name},\n\nIt is time for your scheduled medication: ${dose.medication_name} (${dose.dose_text}).\n${dose.instructions ? `Instructions: ${dose.instructions}\n` : ''}\nPlease open Sahaaya Care to confirm your dose when taken.\n\nWarm regards,\nSahaaya Care Coordination`;

      await sendEmail({
        toEmail: profile.owner_email,
        toName: profile.owner_name,
        subject,
        bodyText: body,
        recipientUserId: profile.owner_user_id,
        notificationEventId: event.id
      });
    }
  } else if (params.eventType === 'DOSE_OVERDUE_UNCONFIRMED') {
    // Recheck dose status - if already taken, skip!
    const dose = db.prepare(`
      SELECT d.*, m.name as medication_name, m.dose_text
      FROM dose_instances d
      JOIN medications m ON d.medication_id = m.id
      WHERE d.id = ?
    `).get(params.entityId) as any;

    if (dose && dose.status === 'OVERDUE_UNCONFIRMED') {
      // 1. Notify the elderly owner first
      const elderSubject = `Sahaaya Care: Check-in on scheduled dose of ${dose.medication_name}`;
      const elderBody = `Hello ${profile.display_name},\n\nNo acknowledgement was recorded for your ${dose.medication_name} scheduled at ${dose.local_scheduled_at}. We hope you are doing well!\n\nPlease open Sahaaya Care to record whether you have taken your medicine or need assistance.\n\nWarm regards,\nSahaaya Care`;

      await sendEmail({
        toEmail: profile.owner_email,
        toName: profile.owner_name,
        subject: elderSubject,
        bodyText: elderBody,
        recipientUserId: profile.owner_user_id,
        notificationEventId: event.id
      });

      // 2. Escalation: Notify authorized family members and caretakers
      const escalationRecipients = members.filter(
        m => m.user_id !== profile.owner_user_id && (m.role === 'FAMILY_ADMIN' || m.role === 'FAMILY_MEMBER' || m.role === 'CARETAKER')
      );

      for (const recipient of escalationRecipients) {
        const familySubject = `Sahaaya Care Alert: Dose check-in for ${profile.display_name}`;
        const familyBody = `Hello ${recipient.display_name},\n\nThis is a care coordination alert regarding ${profile.display_name}.\n\nNo acknowledgement was recorded for ${profile.display_name}'s scheduled dose of ${dose.medication_name} (${dose.dose_text}) within the ${dose.grace_period_minutes || 30}-minute grace period.\n\nPlease check in with ${profile.display_name} to confirm their well-being and routine.\n\n(Note: This notice does not assert the medicine was missed, only that no digital acknowledgement was recorded).\n\nSahaaya Care Coordination`;

        await sendEmail({
          toEmail: recipient.email,
          toName: recipient.display_name,
          subject: familySubject,
          bodyText: familyBody,
          recipientUserId: recipient.user_id,
          notificationEventId: event.id
        });
      }

      recordAuditEvent({
        careProfileId: params.careProfileId,
        action: 'NOTIFICATION_ESCALATED',
        entityType: 'DOSE_INSTANCE',
        entityId: params.entityId,
        reason: `Dose unconfirmed after grace period. Escalated to ${escalationRecipients.length} authorized care circle contacts.`
      });
    }
  } else if (params.eventType === 'APPOINTMENT_REMINDER') {
    const apt = db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(params.entityId) as any;
    if (apt && apt.status === 'SCHEDULED') {
      const subject = `Sahaaya Care: Upcoming Doctor Appointment with Dr. ${apt.doctor_name}`;
      const body = `Hello,\n\nReminder for an upcoming appointment for ${profile.display_name}:\nDoctor: Dr. ${apt.doctor_name} (${apt.specialty || 'General'})\nFacility: ${apt.facility_name}\nWhen: ${apt.starts_at_utc}\nNotes: ${apt.notes || 'None'}\n\nSahaaya Care`;

      // Send to elder owner + family members who have APPOINTMENT_VIEW
      await sendEmail({
        toEmail: profile.owner_email,
        toName: profile.owner_name,
        subject,
        bodyText: body,
        recipientUserId: profile.owner_user_id,
        notificationEventId: event.id
      });
    }
  }

  db.prepare(`UPDATE notification_events SET status = 'PROCESSED' WHERE id = ?`).run(event.id);
  return { eventId: event.id, status: 'PROCESSED' };
}
