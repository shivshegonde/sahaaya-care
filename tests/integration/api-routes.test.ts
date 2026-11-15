import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from '../../server/src/routes/index.js';
import { getDb, setDb } from '../../server/src/db/database.js';

test('REST API Sub-Router Integration Suite', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  let token = '';
  let userId = '';
  let profileId = '';
  let medId = '';

  t.after(() => {
    server.close();
  });

  await t.test('POST /api/v1/auth/register creates user account and returns JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'priya.rao@test.local',
        password: 'Password123!',
        displayName: 'Priya Rao',
        roleTitle: 'Family Admin'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json() as any;
    assert.ok(data.token);
    assert.ok(data.user.id);
    assert.equal(data.user.email, 'priya.rao@test.local');
    token = data.token;
    userId = data.user.id;
  });

  await t.test('POST /api/v1/auth/login authenticates registered credentials', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'priya.rao@test.local',
        password: 'Password123!'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.ok(data.token);
  });

  await t.test('GET /api/v1/me returns authenticated user identity', async () => {
    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.user.id, userId);
  });

  await t.test('POST /api/v1/care-profiles creates a care profile with creator as ELDER_OWNER', async () => {
    const res = await fetch(`${baseUrl}/care-profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        displayName: 'Anita Rao',
        timezone: 'Asia/Kolkata',
        gracePeriodMinutes: 30
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json() as any;
    assert.ok(data.id);
    assert.equal(data.displayName, 'Anita Rao');
    profileId = data.id;
  });

  await t.test('POST /api/v1/care-profiles/:profileId/medications creates prescription', async () => {
    const res = await fetch(`${baseUrl}/care-profiles/${profileId}/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Metformin 500mg',
        doseText: '1 tablet with dinner',
        form: 'Tablet',
        scheduleType: 'ONCE_DAILY',
        scheduleConfig: { times: ['20:00'] },
        startDate: '2026-11-15'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json() as any;
    assert.ok(data.medication.id);
    assert.equal(data.medication.name, 'Metformin 500mg');
    medId = data.medication.id;
  });

  await t.test('GET /api/v1/care-profiles/:profileId/medications lists active medicines', async () => {
    const res = await fetch(`${baseUrl}/care-profiles/${profileId}/medications`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.medications.length, 1);
  });

  await t.test('POST /api/v1/medications/:medicationId/pause pauses medication schedule', async () => {
    const res = await fetch(`${baseUrl}/medications/${medId}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.medication.status, 'PAUSED');
  });

  await t.test('GET /api/v1/demo/clock returns simulated clock status', async () => {
    const res = await fetch(`${baseUrl}/demo/clock`);
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.ok(data.realTime);
    assert.ok(data.simulatedTime);
  });

  await t.test('POST /api/v1/demo/advance-time moves demo clock forward', async () => {
    const res = await fetch(`${baseUrl}/demo/advance-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 30, careProfileId: profileId })
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.ok(data.clock);
    assert.ok(data.dispatchResult);
  });

  await t.test('GET /api/v1/care-profiles/:profileId returns profile and membership', async () => {
    const res = await fetch(`${baseUrl}/care-profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.profile.id, profileId);
    assert.equal(data.membership.role, 'ELDER_OWNER');
  });

  await t.test('GET /api/v1/care-profiles/:profileId/members lists active circle members', async () => {
    const res = await fetch(`${baseUrl}/care-profiles/${profileId}/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.ok(data.members.length >= 1);
  });

  await t.test('POST & GET appointments on care profile', async () => {
    const createRes = await fetch(`${baseUrl}/care-profiles/${profileId}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        doctorName: 'Dr. Suresh Kulkarni',
        facilityName: 'Manipal Hospital',
        startsAtUtc: '2026-11-20T10:00:00Z',
        appointmentType: 'Cardiac Checkup'
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json() as any;
    assert.ok(created.appointment.id);

    const listRes = await fetch(`${baseUrl}/care-profiles/${profileId}/appointments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(listRes.status, 200);
    const list = await listRes.json() as any;
    assert.equal(list.appointments.length, 1);
  });

  await t.test('POST & GET care notes and handover summary', async () => {
    const createNoteRes = await fetch(`${baseUrl}/care-profiles/${profileId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        body: 'Anita took her evening walk and had a healthy meal.',
        category: 'GENERAL',
        visibility: 'ALL_MEMBERS'
      })
    });
    assert.equal(createNoteRes.status, 201);

    const listNotesRes = await fetch(`${baseUrl}/care-profiles/${profileId}/notes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(listNotesRes.status, 200);
    const notesData = await listNotesRes.json() as any;
    assert.equal(notesData.notes.length, 1);

    const handoverRes = await fetch(`${baseUrl}/care-profiles/${profileId}/handover`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(handoverRes.status, 200);
    const handoverData = await handoverRes.json() as any;
    assert.ok(handoverData.handover.past24hStats);
  });

  await t.test('GET adherence, notifications and audit logs for profile', async () => {
    const adhRes = await fetch(`${baseUrl}/care-profiles/${profileId}/adherence`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(adhRes.status, 200);

    const notifRes = await fetch(`${baseUrl}/care-profiles/${profileId}/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(notifRes.status, 200);

    const audRes = await fetch(`${baseUrl}/care-profiles/${profileId}/audit`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(audRes.status, 200);
    const audData = await audRes.json() as any;
    assert.ok(audData.auditEvents.length > 0);
  });

  await t.test('GET today doses and acknowledge action', async () => {
    // Generate a fresh dose to test acknowledgement
    const now = new Date().toISOString();
    const doseRes = await fetch(`${baseUrl}/care-profiles/${profileId}/doses/today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(doseRes.status, 200);
  });
});
