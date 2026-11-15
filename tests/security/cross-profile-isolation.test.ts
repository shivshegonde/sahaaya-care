import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { getUserMembership, hasPermission, PermissionScopes, Roles } from '../../server/src/services/rbac.js';
import { createInvitation, redeemInvitation, revokeMembership } from '../../server/src/services/invitation.js';

test('Security & Profile Isolation Enforcement', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  // Create User A (Elder) and Care Profile A
  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-elder-a', 'sub-a', 'anita@test.local', 'Anita', 'h', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z'),
           ('u-attacker-b', 'sub-b', 'stranger@test.local', 'Stranger', 'h', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z'),
           ('u-caretaker-c', 'sub-c', 'caretaker@test.local', 'Caretaker', 'h', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, created_at, updated_at)
    VALUES ('cp-profile-a', 'u-elder-a', 'Anita Care Profile', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  // Owner membership
  db.prepare(`
    INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
    VALUES ('cm-a', 'cp-profile-a', 'u-elder-a', 'ELDER_OWNER', '["PROFILE_VIEW","MEDICATION_VIEW","MEDICATION_CREATE","MEDICATION_UPDATE","MEDICATION_ARCHIVE","DOSE_ACKNOWLEDGE"]', 'ACTIVE', '2026-11-15T00:00:00Z'),
           ('cm-c', 'cp-profile-a', 'u-caretaker-c', 'CARETAKER', '["PROFILE_VIEW","MEDICATION_VIEW","DOSE_ACKNOWLEDGE"]', 'ACTIVE', '2026-11-15T00:00:00Z')
  `).run();

  await t.test('threat 1: uninvited user B is completely blocked from care profile A', () => {
    const membership = getUserMembership('cp-profile-a', 'u-attacker-b');
    assert.equal(membership, null);
    assert.equal(hasPermission(membership, PermissionScopes.PROFILE_VIEW), false);
    assert.equal(hasPermission(membership, PermissionScopes.MEDICATION_VIEW), false);
  });

  await t.test('threat 2: caretaker C cannot edit medication without MEDICATION_UPDATE scope', () => {
    const membership = getUserMembership('cp-profile-a', 'u-caretaker-c');
    assert.ok(membership);
    assert.equal(hasPermission(membership, PermissionScopes.MEDICATION_VIEW), true);
    assert.equal(hasPermission(membership, PermissionScopes.DOSE_ACKNOWLEDGE), true);
    assert.equal(hasPermission(membership, PermissionScopes.MEDICATION_UPDATE), false);
    assert.equal(hasPermission(membership, PermissionScopes.MEMBER_INVITE), false);
  });

  await t.test('threat 3: invitation tokens cannot be reused once redeemed', () => {
    const invite = createInvitation({
      careProfileId: 'cp-profile-a',
      email: 'newfamily@test.local',
      role: Roles.FAMILY_MEMBER,
      createdByUserId: 'u-elder-a'
    });

    // First redemption succeeds
    const redeemResult = redeemInvitation(invite.rawCode, 'u-attacker-b');
    assert.ok(redeemResult.membershipId);

    // Second redemption attempt fails
    assert.throws(() => {
      redeemInvitation(invite.rawCode, 'u-attacker-b');
    }, /already been redeemed/);
  });

  await t.test('threat 4: revoked member immediately loses all access', () => {
    revokeMembership('cp-profile-a', 'u-attacker-b', 'u-elder-a');
    const membership = getUserMembership('cp-profile-a', 'u-attacker-b');
    assert.equal(membership, null); // Inactive/revoked returns null
  });
});
