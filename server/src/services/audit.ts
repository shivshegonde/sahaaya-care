import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

export interface AuditEntry {
  careProfileId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  reason?: string;
  correlationId?: string;
}

export function recordAuditEvent(entry: AuditEntry): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO audit_events (
      id, care_profile_id, actor_user_id, action, entity_type, entity_id,
      before_snapshot, after_snapshot, reason, correlation_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    entry.careProfileId,
    entry.actorUserId || null,
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.beforeSnapshot ? JSON.stringify(entry.beforeSnapshot) : null,
    entry.afterSnapshot ? JSON.stringify(entry.afterSnapshot) : null,
    entry.reason || null,
    entry.correlationId || null,
    now
  );

  return id;
}

export function getAuditEvents(careProfileId: string, limit = 50, offset = 0) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.*, u.display_name as actor_name, u.email as actor_email
    FROM audit_events a
    LEFT JOIN users u ON a.actor_user_id = u.id
    WHERE a.care_profile_id = ?
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(careProfileId, limit, offset) as any[];

  return rows.map(r => ({
    ...r,
    before_snapshot: r.before_snapshot ? JSON.parse(r.before_snapshot) : null,
    after_snapshot: r.after_snapshot ? JSON.parse(r.after_snapshot) : null
  }));
}
