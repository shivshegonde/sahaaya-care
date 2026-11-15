import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { getDb, setDb } from '../../server/src/db/database.js';
import { config } from '../../server/src/config.js';
import { createMedication, generateDosesForMedication } from '../../server/src/services/medication.js';
import { requireAuth } from '../../server/src/services/auth.js';
import { createInvitation, redeemInvitation, revokeMembership } from '../../server/src/services/invitation.js';
import { requirePermission, PermissionScopes, getUserMembership } from '../../server/src/services/rbac.js';

test('Comprehensive Domain Edge Cases & Error Branch Coverage', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-edge-1', 'sub-edge-1', 'anita@test.local', 'Anita Rao', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-edge-2', 'sub-edge-2', 'ravi@test.local', 'Ravi Nurse', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-edge-1', 'u-edge-1', 'Anita Care Profile', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
    VALUES ('cm-edge-1', 'cp-edge-1', 'u-edge-1', 'ELDER_OWNER', '["ALL"]', 'ACTIVE', '2026-11-15T00:00:00Z')
  `).run();

  // 1. MEDICATION.TS: WEEKDAYS schedule & end_date boundary tests
  await t.test('medication.ts: covers end_date boundary and WEEKDAYS day filtering', () => {
    // With end_date
    const medEndDate = createMedication({
      careProfileId: 'cp-edge-1',
      name: 'Amoxicillin 500mg',
      doseText: '1 capsule three times daily',
      form: 'Capsule',
      scheduleType: 'FIXED_TIMES',
      scheduleConfig: { times: ['08:00', '14:00', '20:00'] },
      startDate: '2026-11-15',
      endDate: '2026-11-17',
      userId: 'u-edge-1'
    });
    assert.ok(medEndDate);

    // With WEEKDAYS
    const medWeekdays = createMedication({
      careProfileId: 'cp-edge-1',
      name: 'Physiotherapy Vitamin D',
      doseText: '1 tablet with water',
      form: 'Tablet',
      scheduleType: 'WEEKDAYS',
      scheduleConfig: { times: ['10:00'], days: ['monday', 'friday'] },
      startDate: '2026-11-15',
      userId: 'u-edge-1'
    });
    assert.ok(medWeekdays);
  });

  // 2. AUTH.TS: requireAuth failure paths (missing header, deleted user, malformed token)
  await t.test('auth.ts: handles missing bearer, non-existent user, and malformed token', () => {
    // Missing token
    let statusCode = 0;
    let jsonResp: any = null;
    const mockRes1: any = {
      status: (code: number) => { statusCode = code; return { json: (d: any) => { jsonResp = d; } }; }
    };
    requireAuth({ headers: {} } as any, mockRes1, () => {});
    assert.equal(statusCode, 401);
    assert.ok(jsonResp.error.includes('Missing Bearer token'));

    // Malformed token
    requireAuth({ headers: { authorization: 'Bearer completely.invalid.jwt' } } as any, mockRes1, () => {});
    assert.equal(statusCode, 401);
    assert.ok(jsonResp.error.includes('Invalid or expired'));

    // Token for non-existent user in DB
    const phantomToken = jwt.sign({ sub: 'user-does-not-exist' }, config.jwtSecret);
    requireAuth({ headers: { authorization: `Bearer ${phantomToken}` } } as any, mockRes1, () => {});
    assert.equal(statusCode, 401);
    assert.ok(jsonResp.error.includes('User account not found'));
  });

  // 3. INVITATION.TS: failure branches and owner protection
  await t.test('invitation.ts: covers invalid codes, expired codes, revoked codes, and owner protection', () => {
    // Invalid code
    assert.throws(() => {
      redeemInvitation('SHY-NONEXISTENT', 'u-edge-2');
    }, /Invalid invitation code/);

    // Expired code
    const expiredInvite = createInvitation({
      careProfileId: 'cp-edge-1',
      email: 'expired@test.local',
      role: 'CARETAKER',
      createdByUserId: 'u-edge-1',
      expiresInHours: -1 // Already expired
    });
    assert.throws(() => {
      redeemInvitation(expiredInvite.rawCode, 'u-edge-2');
    }, /expired/);

    // Revoked invite
    const revokedInvite = createInvitation({
      careProfileId: 'cp-edge-1',
      email: 'revoked@test.local',
      role: 'CARETAKER',
      createdByUserId: 'u-edge-1'
    });
    db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), revokedInvite.invitationId);
    assert.throws(() => {
      redeemInvitation(revokedInvite.rawCode, 'u-edge-2');
    }, /revoked/);

    // Cannot revoke ELDER_OWNER
    assert.throws(() => {
      revokeMembership('cp-edge-1', 'u-edge-1', 'u-edge-1');
    }, /Cannot revoke access for the care profile owner/);

    // Revoking non-existent membership
    assert.throws(() => {
      revokeMembership('cp-edge-1', 'u-fake-member', 'u-edge-1');
    }, /Membership not found/);

    // Valid invitation redemption (first time)
    const validInvite = createInvitation({
      careProfileId: 'cp-edge-1',
      email: 'ravi@test.local',
      role: 'CARETAKER',
      createdByUserId: 'u-edge-1'
    });
    const result1 = redeemInvitation(validInvite.rawCode, 'u-edge-2');
    assert.equal(result1.role, 'CARETAKER');

    // Attempting to redeem already redeemed invite
    assert.throws(() => {
      redeemInvitation(validInvite.rawCode, 'u-edge-2');
    }, /already been redeemed/);

    // Re-redeeming when membership already exists updates existing record
    const secondInvite = createInvitation({
      careProfileId: 'cp-edge-1',
      email: 'ravi@test.local',
      role: 'FAMILY_ADMIN',
      createdByUserId: 'u-edge-1'
    });
    const result2 = redeemInvitation(secondInvite.rawCode, 'u-edge-2');
    assert.equal(result2.role, 'FAMILY_ADMIN');

    // Revoking an active caretaker membership
    revokeMembership('cp-edge-1', 'u-edge-2', 'u-edge-1');
    const revokedMem = getUserMembership('cp-edge-1', 'u-edge-2');
    assert.equal(revokedMem, null); // Inactive/revoked members are not returned by getUserMembership
  });

  // 4. RBAC.TS: requirePermission middleware branches
  await t.test('rbac.ts: covers requirePermission middleware unauth, missing param, non-member, and corrupted permissions', () => {
    const middleware = requirePermission(PermissionScopes.PROFILE_VIEW);
    let statusCode = 0;
    let jsonResp: any = null;
    let nextCalled = false;
    const mockRes: any = {
      status: (code: number) => { statusCode = code; return { json: (d: any) => { jsonResp = d; } }; }
    };

    // Unauthenticated
    middleware({ user: undefined } as any, mockRes, () => { nextCalled = true; });
    assert.equal(statusCode, 401);

    // Missing profileId parameter
    middleware({ user: { id: 'u-edge-1' }, params: {}, body: {}, query: {} } as any, mockRes, () => { nextCalled = true; });
    assert.equal(statusCode, 400);

    // ProfileId via body
    nextCalled = false;
    middleware({ user: { id: 'u-edge-1' }, params: {}, body: { care_profile_id: 'cp-edge-1' }, query: {} } as any, mockRes, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    // ProfileId via query
    nextCalled = false;
    middleware({ user: { id: 'u-edge-1' }, params: {}, body: {}, query: { profileId: 'cp-edge-1' } } as any, mockRes, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    // Not a member
    middleware({ user: { id: 'u-uninvited' }, params: { profileId: 'cp-edge-1' }, body: {}, query: {} } as any, mockRes, () => { nextCalled = true; });
    assert.equal(statusCode, 403);

    // Missing required permission scope
    const restrictedMiddleware = requirePermission(PermissionScopes.MEDICATION_ARCHIVE);
    db.prepare(`
      INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
      VALUES ('u-restricted', 'sub-restricted', 'viewer@test.local', 'Viewer Only', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
    `).run();
    db.prepare(`
      INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
      VALUES ('cm-restricted', 'cp-edge-1', 'u-restricted', 'FAMILY_MEMBER', '["PROFILE_VIEW"]', 'ACTIVE', '2026-11-15T00:00:00Z')
    `).run();

    restrictedMiddleware({ user: { id: 'u-restricted' }, params: { profileId: 'cp-edge-1' }, body: {}, query: {} } as any, mockRes, () => { nextCalled = true; });
    assert.equal(statusCode, 403);
    assert.ok(jsonResp.error.includes('Missing required permission scope'));

    // Corrupted permissions JSON in database fallback to []
    db.prepare(`
      INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
      VALUES ('u-corrupted', 'sub-corrupted', 'corrupt@test.local', 'Corrupt User', 'hash', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
    `).run();
    db.prepare(`
      INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
      VALUES ('cm-corrupted', 'cp-edge-1', 'u-corrupted', 'CARETAKER', '{not-valid-json}', 'ACTIVE', '2026-11-15T00:00:00Z')
    `).run();
    const corruptedMembership = getUserMembership('cp-edge-1', 'u-corrupted');
    assert.deepEqual(corruptedMembership?.permissions, []);
  });
});

