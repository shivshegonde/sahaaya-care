import { getDb } from '../db/database.js';
import { recordAuditEvent } from './audit.js';
import { createOutboxEvent } from './outbox.js';

export const DoseStatuses = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  ACKNOWLEDGED_TAKEN: 'ACKNOWLEDGED_TAKEN',
  ACKNOWLEDGED_SKIPPED: 'ACKNOWLEDGED_SKIPPED',
  UNABLE_TO_TAKE: 'UNABLE_TO_TAKE',
  OVERDUE_UNCONFIRMED: 'OVERDUE_UNCONFIRMED',
  CANCELLED: 'CANCELLED'
} as const;

export type DoseStatus = (typeof DoseStatuses)[keyof typeof DoseStatuses];

export function getDoseById(doseId: string) {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, m.name as medication_name, m.brand_name, m.dose_text, m.form, m.instructions,
           u.display_name as acknowledged_by_name
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    LEFT JOIN users u ON d.acknowledged_by = u.id
    WHERE d.id = ?
  `).get(doseId) as any;
}

export function getTodayDosesForProfile(careProfileId: string, referenceTimeUtc?: string) {
  const db = getDb();
  // Automatically evaluate transitions before returning
  evaluateDoseTransitions(careProfileId, referenceTimeUtc);

  const ref = referenceTimeUtc ? new Date(referenceTimeUtc) : new Date();
  const startOfDay = new Date(ref);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(ref);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const rows = db.prepare(`
    SELECT d.*, m.name as medication_name, m.brand_name, m.dose_text, m.form, m.instructions,
           u.display_name as acknowledged_by_name
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    LEFT JOIN users u ON d.acknowledged_by = u.id
    WHERE d.care_profile_id = ?
      AND d.scheduled_at_utc >= ?
      AND d.scheduled_at_utc <= ?
      AND d.status != 'CANCELLED'
    ORDER BY d.scheduled_at_utc ASC
  `).all(careProfileId, startOfDay.toISOString(), endOfDay.toISOString()) as any[];

  return rows;
}

export function getDoseHistoryForProfile(careProfileId: string, startDateIso: string, endDateIso: string) {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, m.name as medication_name, m.brand_name, m.dose_text, m.form,
           u.display_name as acknowledged_by_name
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    LEFT JOIN users u ON d.acknowledged_by = u.id
    WHERE d.care_profile_id = ?
      AND d.scheduled_at_utc >= ?
      AND d.scheduled_at_utc <= ?
    ORDER BY d.scheduled_at_utc DESC
  `).all(careProfileId, startDateIso, endDateIso) as any[];
}

export function acknowledgeDoseTaken(doseId: string, actorUserId: string, note?: string) {
  const db = getDb();
  const current = getDoseById(doseId);
  if (!current) throw new Error('Dose instance not found');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE dose_instances
    SET status = 'ACKNOWLEDGED_TAKEN',
        acknowledged_at = ?,
        acknowledged_by = ?,
        acknowledgement_note = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, actorUserId, note?.trim() || null, now, doseId);

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'DOSE_ACKNOWLEDGED_TAKEN',
    entityType: 'DOSE_INSTANCE',
    entityId: doseId,
    beforeSnapshot: { status: current.status },
    afterSnapshot: { status: 'ACKNOWLEDGED_TAKEN', acknowledgedAt: now, note },
    reason: `Acknowledged dose taken for ${current.medication_name}`
  });

  return getDoseById(doseId);
}

export function acknowledgeDoseSkipped(doseId: string, actorUserId: string, reason?: string) {
  const db = getDb();
  const current = getDoseById(doseId);
  if (!current) throw new Error('Dose instance not found');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE dose_instances
    SET status = 'ACKNOWLEDGED_SKIPPED',
        acknowledged_at = ?,
        acknowledged_by = ?,
        acknowledgement_note = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, actorUserId, reason?.trim() || 'Skipped by user', now, doseId);

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'DOSE_ACKNOWLEDGED_SKIPPED',
    entityType: 'DOSE_INSTANCE',
    entityId: doseId,
    beforeSnapshot: { status: current.status },
    afterSnapshot: { status: 'ACKNOWLEDGED_SKIPPED', acknowledgedAt: now, reason },
    reason: `Recorded dose skipped for ${current.medication_name}`
  });

  return getDoseById(doseId);
}

export function markDoseUnableToTake(doseId: string, actorUserId: string, reason?: string) {
  const db = getDb();
  const current = getDoseById(doseId);
  if (!current) throw new Error('Dose instance not found');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE dose_instances
    SET status = 'UNABLE_TO_TAKE',
        acknowledged_at = ?,
        acknowledged_by = ?,
        acknowledgement_note = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, actorUserId, reason?.trim() || 'Unable to take', now, doseId);

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'DOSE_UNABLE_TO_TAKE',
    entityType: 'DOSE_INSTANCE',
    entityId: doseId,
    beforeSnapshot: { status: current.status },
    afterSnapshot: { status: 'UNABLE_TO_TAKE', acknowledgedAt: now, reason },
    reason: `Recorded unable to take dose for ${current.medication_name}: ${reason || ''}`
  });

  return getDoseById(doseId);
}

export function correctDoseAcknowledgement(doseId: string, actorUserId: string, newStatus: DoseStatus, reason: string) {
  const db = getDb();
  const current = getDoseById(doseId);
  if (!current) throw new Error('Dose instance not found');
  if (!reason || reason.trim().length === 0) {
    throw new Error('A reason is required when correcting a dose status.');
  }

  const now = new Date().toISOString();
  const isPending = newStatus === 'UPCOMING' || newStatus === 'DUE' || newStatus === 'OVERDUE_UNCONFIRMED';

  db.prepare(`
    UPDATE dose_instances
    SET status = ?,
        acknowledged_at = ?,
        acknowledged_by = ?,
        acknowledgement_note = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    newStatus,
    isPending ? null : now,
    isPending ? null : actorUserId,
    isPending ? null : `Corrected: ${reason.trim()}`,
    now,
    doseId
  );

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'DOSE_ACKNOWLEDGEMENT_CORRECTED',
    entityType: 'DOSE_INSTANCE',
    entityId: doseId,
    beforeSnapshot: { status: current.status, acknowledged_at: current.acknowledged_at },
    afterSnapshot: { status: newStatus, reason: reason.trim() },
    reason: `Corrected status from ${current.status} to ${newStatus}: ${reason.trim()}`
  });

  return getDoseById(doseId);
}

// Evaluate state transitions based on reference time
export function evaluateDoseTransitions(careProfileId: string, referenceTimeUtc?: string) {
  const db = getDb();
  const now = referenceTimeUtc ? new Date(referenceTimeUtc) : new Date();
  const nowIso = now.toISOString();

  const transitionedDoses: any[] = [];

  // 1. Transition UPCOMING -> DUE if scheduled_at_utc <= now
  const dueCandidates = db.prepare(`
    SELECT d.id, d.care_profile_id, d.scheduled_at_utc, d.local_scheduled_at, m.name as medication_name, m.dose_text
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    WHERE d.care_profile_id = ?
      AND d.status = 'UPCOMING'
      AND d.scheduled_at_utc <= ?
  `).all(careProfileId, nowIso) as any[];

  for (const dose of dueCandidates) {
    db.prepare(`
      UPDATE dose_instances SET status = 'DUE', updated_at = ? WHERE id = ?
    `).run(nowIso, dose.id);

    transitionedDoses.push({
      id: dose.id,
      medicationName: dose.medication_name,
      doseText: dose.dose_text,
      transition: 'UPCOMING -> DUE',
      time: dose.local_scheduled_at
    });

    // Queue notification outbox event for dose due
    createOutboxEvent({
      eventType: 'DOSE_DUE',
      aggregateId: dose.id,
      payload: {
        careProfileId: dose.care_profile_id,
        doseId: dose.id,
        scheduledAt: dose.scheduled_at_utc,
        medicationName: dose.medication_name,
        doseText: dose.dose_text
      }
    });
  }

  // 2. Transition DUE -> OVERDUE_UNCONFIRMED if now >= scheduled_at_utc + grace_period_minutes
  const allDue = db.prepare(`
    SELECT d.id, d.care_profile_id, d.scheduled_at_utc, d.local_scheduled_at, d.grace_period_minutes, m.name as medication_name, m.dose_text
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    WHERE d.care_profile_id = ?
      AND d.status = 'DUE'
  `).all(careProfileId) as any[];

  let overdueCount = 0;
  for (const dose of allDue) {
    const scheduledTime = new Date(dose.scheduled_at_utc).getTime();
    const graceMs = (dose.grace_period_minutes || 30) * 60 * 1000;
    if (now.getTime() >= scheduledTime + graceMs) {
      db.prepare(`
        UPDATE dose_instances SET status = 'OVERDUE_UNCONFIRMED', updated_at = ? WHERE id = ?
      `).run(nowIso, dose.id);

      overdueCount++;
      transitionedDoses.push({
        id: dose.id,
        medicationName: dose.medication_name,
        doseText: dose.dose_text,
        transition: 'DUE -> OVERDUE_UNCONFIRMED',
        time: dose.local_scheduled_at
      });

      // Queue overdue escalation outbox event
      createOutboxEvent({
        eventType: 'DOSE_OVERDUE_UNCONFIRMED',
        aggregateId: dose.id,
        payload: {
          careProfileId: dose.care_profile_id,
          doseId: dose.id,
          scheduledAt: dose.scheduled_at_utc,
          gracePeriodMinutes: dose.grace_period_minutes || 30,
          medicationName: dose.medication_name,
          doseText: dose.dose_text
        }
      });
    }
  }

  return {
    dueTransitionsCount: dueCandidates.length,
    overdueTransitionsCount: overdueCount,
    transitionedDoses
  };
}
