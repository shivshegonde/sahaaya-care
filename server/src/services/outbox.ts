import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

export interface OutboxPayload {
  eventType: string;
  aggregateId: string;
  payload: Record<string, any>;
}

export function createOutboxEvent(event: OutboxPayload): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO outbox_events (id, event_type, aggregate_id, payload, attempt_count, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);

  stmt.run(id, event.eventType, event.aggregateId, JSON.stringify(event.payload), now);
  return id;
}

export function getPendingOutboxEvents(limit = 20) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM outbox_events
    WHERE published_at IS NULL AND attempt_count < 5
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(r => ({
    ...r,
    payload: JSON.parse(r.payload)
  }));
}

export function markOutboxEventPublished(id: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE outbox_events SET published_at = ? WHERE id = ?`).run(now, id);
}

export function incrementOutboxAttempt(id: string) {
  const db = getDb();
  db.prepare(`UPDATE outbox_events SET attempt_count = attempt_count + 1 WHERE id = ?`).run(id);
}
