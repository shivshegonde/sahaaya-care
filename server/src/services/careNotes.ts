import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { recordAuditEvent } from './audit.js';

export interface CareNoteInput {
  careProfileId: string;
  category?: 'GENERAL' | 'APPOINTMENT' | 'MEDICATION_OBSERVATION' | 'FOLLOW_UP';
  body: string;
  visibility?: 'ALL_MEMBERS' | 'FAMILY_ONLY' | 'CARETAKER_ONLY';
  userId: string;
}

export function createCareNote(input: CareNoteInput) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO care_notes (id, care_profile_id, author_user_id, category, body, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.careProfileId,
    input.userId,
    input.category || 'GENERAL',
    input.body.trim(),
    input.visibility || 'ALL_MEMBERS',
    now,
    now
  );

  recordAuditEvent({
    careProfileId: input.careProfileId,
    actorUserId: input.userId,
    action: 'CARE_NOTE_CREATED',
    entityType: 'CARE_NOTE',
    entityId: id,
    reason: `Added note in category ${input.category || 'GENERAL'}`
  });

  return getCareNoteById(id);
}

export function getCareNoteById(id: string) {
  const db = getDb();
  return db.prepare(`
    SELECT n.*, u.display_name as author_name, u.email as author_email
    FROM care_notes n
    JOIN users u ON n.author_user_id = u.id
    WHERE n.id = ?
  `).get(id) as any;
}

export function getCareNotesForProfile(careProfileId: string, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT n.*, u.display_name as author_name, u.email as author_email
    FROM care_notes n
    JOIN users u ON n.author_user_id = u.id
    WHERE n.care_profile_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(careProfileId, limit) as any[];
}

// Generate smart care handover summary for shift change or next caregiver
export function generateHandoverSummary(careProfileId: string) {
  const db = getDb();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // 1. Doses in the last 24h
  const pastDoses = db.prepare(`
    SELECT d.*, m.name as medication_name, u.display_name as ack_by
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    LEFT JOIN users u ON d.acknowledged_by = u.id
    WHERE d.care_profile_id = ?
      AND d.scheduled_at_utc >= ?
      AND d.scheduled_at_utc <= ?
    ORDER BY d.scheduled_at_utc ASC
  `).all(careProfileId, last24h, now.toISOString()) as any[];

  // 2. Upcoming doses in next 24h
  const upcomingDoses = db.prepare(`
    SELECT d.*, m.name as medication_name, m.instructions
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    WHERE d.care_profile_id = ?
      AND d.scheduled_at_utc > ?
      AND d.scheduled_at_utc <= ?
      AND d.status = 'UPCOMING'
    ORDER BY d.scheduled_at_utc ASC
  `).all(careProfileId, now.toISOString(), next24h) as any[];

  // 3. Upcoming appointments
  const upcomingAppointments = db.prepare(`
    SELECT * FROM appointments
    WHERE care_profile_id = ?
      AND starts_at_utc >= ?
      AND starts_at_utc <= ?
      AND status = 'SCHEDULED'
  `).all(careProfileId, now.toISOString(), new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString()) as any[];

  // 4. Recent notes
  const recentNotes = db.prepare(`
    SELECT n.*, u.display_name as author_name
    FROM care_notes n
    JOIN users u ON n.author_user_id = u.id
    WHERE n.care_profile_id = ?
      AND n.created_at >= ?
    ORDER BY n.created_at DESC
  `).all(careProfileId, last24h) as any[];

  const takenCount = pastDoses.filter(d => d.status === 'ACKNOWLEDGED_TAKEN').length;
  const skippedCount = pastDoses.filter(d => d.status === 'ACKNOWLEDGED_SKIPPED').length;
  const unconfirmedCount = pastDoses.filter(d => d.status === 'OVERDUE_UNCONFIRMED' || d.status === 'DUE').length;

  return {
    generatedAt: now.toISOString(),
    past24hStats: {
      totalScheduled: pastDoses.length,
      takenCount,
      skippedCount,
      unconfirmedCount
    },
    unconfirmedDoses: pastDoses.filter(d => d.status === 'OVERDUE_UNCONFIRMED' || d.status === 'DUE'),
    recentNotes,
    upcomingDosesSummary: upcomingDoses.slice(0, 5),
    upcomingAppointments
  };
}
