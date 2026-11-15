import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { recordAuditEvent } from './audit.js';

export interface ScheduleConfig {
  times: string[]; // e.g. ["08:00", "20:00"] (HH:MM in 24hr format)
  days?: string[]; // e.g. ["monday", "wednesday", "friday"] for WEEKDAYS
  every_x_hours?: number; // for INTERVAL
  start_time?: string;
}

export interface MedicationInput {
  careProfileId: string;
  name: string;
  brandName?: string;
  doseText: string;
  form: string;
  route?: string;
  instructions?: string;
  scheduleType: 'FIXED_TIMES' | 'ONCE_DAILY' | 'WEEKDAYS' | 'INTERVAL';
  scheduleConfig: ScheduleConfig;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  timezone?: string;
  prescriber?: string;
  userId: string;
}

export function createMedication(input: MedicationInput) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const timezone = input.timezone || 'Asia/Kolkata';

  const stmt = db.prepare(`
    INSERT INTO medications (
      id, care_profile_id, name, brand_name, dose_text, form, route,
      instructions, schedule_type, schedule_config, start_date, end_date,
      timezone, status, prescriber, created_by, updated_by, version,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 1, ?, ?)
  `);

  stmt.run(
    id,
    input.careProfileId,
    input.name.trim(),
    input.brandName?.trim() || null,
    input.doseText.trim(),
    input.form,
    input.route || 'Oral',
    input.instructions?.trim() || null,
    input.scheduleType,
    JSON.stringify(input.scheduleConfig),
    input.startDate,
    input.endDate || null,
    timezone,
    input.prescriber?.trim() || null,
    input.userId,
    input.userId,
    now,
    now
  );

  recordAuditEvent({
    careProfileId: input.careProfileId,
    actorUserId: input.userId,
    action: 'MEDICATION_CREATED',
    entityType: 'MEDICATION',
    entityId: id,
    afterSnapshot: {
      name: input.name,
      doseText: input.doseText,
      scheduleType: input.scheduleType,
      scheduleConfig: input.scheduleConfig
    },
    reason: `Added new medication schedule: ${input.name}`
  });

  // Generate initial doses for the next 14 days
  generateDosesForMedication(id, input.startDate, 14);

  return getMedicationById(id);
}

export function getMedicationById(medicationId: string) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM medications WHERE id = ?`).get(medicationId) as any;
  if (!row) return null;
  return {
    ...row,
    schedule_config: JSON.parse(row.schedule_config)
  };
}

export function getMedicationsForProfile(careProfileId: string) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM medications
    WHERE care_profile_id = ?
    ORDER BY status = 'ACTIVE' DESC, name ASC
  `).all(careProfileId) as any[];

  return rows.map(r => ({
    ...r,
    schedule_config: JSON.parse(r.schedule_config)
  }));
}

export function updateMedication(medicationId: string, updates: Partial<MedicationInput>, actorUserId: string) {
  const db = getDb();
  const current = getMedicationById(medicationId);
  if (!current) throw new Error('Medication not found');

  const now = new Date().toISOString();
  const newVersion = current.version + 1;

  const newName = updates.name !== undefined ? updates.name.trim() : current.name;
  const newBrand = updates.brandName !== undefined ? updates.brandName?.trim() : current.brand_name;
  const newDose = updates.doseText !== undefined ? updates.doseText.trim() : current.dose_text;
  const newForm = updates.form !== undefined ? updates.form : current.form;
  const newInstructions = updates.instructions !== undefined ? updates.instructions?.trim() : current.instructions;
  const newScheduleType = updates.scheduleType || current.schedule_type;
  const newConfig = updates.scheduleConfig ? JSON.stringify(updates.scheduleConfig) : JSON.stringify(current.schedule_config);
  const newEnd = updates.endDate !== undefined ? updates.endDate : current.end_date;

  db.prepare(`
    UPDATE medications
    SET name = ?, brand_name = ?, dose_text = ?, form = ?, instructions = ?,
        schedule_type = ?, schedule_config = ?, end_date = ?, updated_by = ?,
        version = ?, updated_at = ?
    WHERE id = ?
  `).run(
    newName,
    newBrand,
    newDose,
    newForm,
    newInstructions,
    newScheduleType,
    newConfig,
    newEnd,
    actorUserId,
    newVersion,
    now,
    medicationId
  );

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: 'MEDICATION_UPDATED',
    entityType: 'MEDICATION',
    entityId: medicationId,
    beforeSnapshot: current,
    afterSnapshot: { name: newName, doseText: newDose, version: newVersion },
    reason: `Updated medication schedule and details`
  });

  return getMedicationById(medicationId);
}

export function setMedicationStatus(medicationId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED', actorUserId: string) {
  const db = getDb();
  const current = getMedicationById(medicationId);
  if (!current) throw new Error('Medication not found');

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE medications SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?
  `).run(status, actorUserId, now, medicationId);

  // If paused or archived, cancel future upcoming doses
  if (status !== 'ACTIVE') {
    db.prepare(`
      UPDATE dose_instances
      SET status = 'CANCELLED', updated_at = ?
      WHERE medication_id = ? AND status = 'UPCOMING'
    `).run(now, medicationId);
  }

  recordAuditEvent({
    careProfileId: current.care_profile_id,
    actorUserId,
    action: `MEDICATION_${status}`,
    entityType: 'MEDICATION',
    entityId: medicationId,
    reason: `Changed medication status to ${status}`
  });

  return getMedicationById(medicationId);
}

// Generate recurring dose instances idempotently
export function generateDosesForMedication(medicationId: string, fromDateStr: string, daysAhead = 14) {
  const db = getDb();
  const med = getMedicationById(medicationId);
  if (!med || med.status !== 'ACTIVE') return [];

  const generatedDoses: any[] = [];
  const cfg: ScheduleConfig = med.schedule_config;
  const startDate = new Date(fromDateStr);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO dose_instances (
      id, care_profile_id, medication_id, scheduled_at_utc, local_scheduled_at,
      timezone, status, grace_period_minutes, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'UPCOMING', 30, ?, ?, ?)
  `);

  for (let i = 0; i < daysAhead; i++) {
    const targetDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    if (med.end_date && dateStr > med.end_date) {
      break;
    }

    if (med.schedule_type === 'WEEKDAYS') {
      if (cfg.days && !cfg.days.map(d => d.toLowerCase()).includes(dayOfWeek)) {
        continue;
      }
    }

    const timesToSchedule = cfg.times && cfg.times.length > 0 ? cfg.times : ['09:00'];

    for (const timeStr of timesToSchedule) {
      const [hourStr, minStr] = timeStr.split(':');
      const hour = parseInt(hourStr || '9', 10);
      const min = parseInt(minStr || '0', 10);

      // Create local ISO string
      const localScheduled = `${dateStr}T${timeStr.padStart(5, '0')}:00`;
      
      // Calculate UTC timestamp approximating timezone offset or standard ISO
      // For India Standard Time (Asia/Kolkata), UTC is -5:30
      // In a robust engine we calculate offset dynamically
      const targetLocalTime = new Date(`${dateStr}T${hourStr.padStart(2, '0')}:${minStr.padStart(2, '0')}:00+05:30`);
      const scheduledUtc = targetLocalTime.toISOString();

      const idempotencyKey = `${medicationId}_${scheduledUtc}`;
      const doseId = crypto.randomUUID();
      const now = new Date().toISOString();

      const result = stmt.run(
        doseId,
        med.care_profile_id,
        med.id,
        scheduledUtc,
        localScheduled,
        med.timezone,
        idempotencyKey,
        now,
        now
      );

      if (result.changes > 0) {
        generatedDoses.push({ id: doseId, scheduledUtc, localScheduled });
      }
    }
  }

  return generatedDoses;
}
