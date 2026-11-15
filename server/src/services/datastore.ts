import { Datastore } from '@google-cloud/datastore';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/database.js';

let datastoreClient: Datastore | null = null;

export function getDatastore(): Datastore {
  if (datastoreClient) return datastoreClient;

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './donotpush/gcp-key.json';
  const hasKeyFile = fs.existsSync(keyPath);

  datastoreClient = new Datastore({
    projectId: config.projectId || 'ai-builder-sql-copilot',
    ...(hasKeyFile ? { keyFilename: keyPath } : {})
  });

  return datastoreClient;
}

export async function checkDatastoreHealth(): Promise<{ status: string; projectId: string }> {
  try {
    const ds = getDatastore();
    const testKey = ds.key(['SahaayaSystemHealth', 'ping']);
    await ds.save({
      key: testKey,
      data: {
        service: 'sahaaya-care',
        status: 'HEALTHY',
        lastChecked: new Date().toISOString()
      }
    });
    return { status: 'CONNECTED', projectId: config.projectId };
  } catch (err: any) {
    console.error('[Google Datastore Error]:', err?.message || err);
    return { status: 'DISCONNECTED', projectId: config.projectId };
  }
}

export async function syncEntityToDatastore(kind: string, id: string, data: Record<string, any>) {
  try {
    const ds = getDatastore();
    const key = ds.key([kind, id]);
    await ds.save({
      key,
      data: {
        ...data,
        synced_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error(`[Datastore Sync Error for ${kind}/${id}]:`, err?.message || err);
  }
}

export async function syncEntitiesBatchToDatastore(items: Array<{ kind: string; id: string; data: Record<string, any> }>) {
  if (!items || items.length === 0) return;
  try {
    const ds = getDatastore();
    const now = new Date().toISOString();
    const entities = items.map(item => ({
      key: ds.key([item.kind, item.id]),
      data: {
        ...item.data,
        synced_at: now
      }
    }));
    await ds.save(entities);
  } catch (err: any) {
    console.error(`[Datastore Batch Sync Error for ${items.length} entities]:`, err?.message || err);
  }
}

export async function syncFullProfileToDatastore(careProfileId: string) {
  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM care_profiles WHERE id = ?').get(careProfileId) as any;
    if (!profile) return;

    const batch: Array<{ kind: string; id: string; data: Record<string, any> }> = [
      { kind: 'CareProfile', id: profile.id, data: profile }
    ];

    const meds = db.prepare('SELECT * FROM medications WHERE care_profile_id = ?').all(careProfileId) as any[];
    for (const m of meds) {
      batch.push({ kind: 'Medication', id: m.id, data: m });
    }

    const doses = db.prepare('SELECT * FROM dose_instances WHERE care_profile_id = ?').all(careProfileId) as any[];
    for (const d of doses) {
      batch.push({ kind: 'DoseInstance', id: d.id, data: d });
    }

    const appointments = db.prepare('SELECT * FROM appointments WHERE care_profile_id = ?').all(careProfileId) as any[];
    for (const a of appointments) {
      batch.push({ kind: 'Appointment', id: a.id, data: a });
    }

    const notes = db.prepare('SELECT * FROM care_notes WHERE care_profile_id = ?').all(careProfileId) as any[];
    for (const n of notes) {
      batch.push({ kind: 'CareNote', id: n.id, data: n });
    }

    await syncEntitiesBatchToDatastore(batch);
    console.log(`[Google Cloud Datastore] Successfully synchronized profile ${careProfileId} (${batch.length} entities in 1 batch)`);
  } catch (err: any) {
    console.error('[Datastore Profile Sync Error]:', err?.message || err);
  }
}
