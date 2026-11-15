import test from 'node:test';
import assert from 'node:assert/strict';
import { Roles, PermissionScopes, DEFAULT_ROLE_SCOPES } from '../../server/src/services/rbac.js';

test('RBAC Permission Matrix & Scope Enforcements', async (t) => {
  await t.test('ELDER_OWNER role contains all 12 permission scopes', () => {
    const elderScopes = DEFAULT_ROLE_SCOPES[Roles.ELDER_OWNER];
    assert.equal(elderScopes.length, 12);
    assert.ok(elderScopes.includes(PermissionScopes.MEMBER_REVOKE));
    assert.ok(elderScopes.includes(PermissionScopes.MEDICATION_ARCHIVE));
  });

  await t.test('CARETAKER cannot modify medications or manage member circle', () => {
    const caretakerScopes = DEFAULT_ROLE_SCOPES[Roles.CARETAKER];
    assert.ok(!caretakerScopes.includes(PermissionScopes.MEDICATION_CREATE));
    assert.ok(!caretakerScopes.includes(PermissionScopes.MEDICATION_UPDATE));
    assert.ok(!caretakerScopes.includes(PermissionScopes.MEDICATION_ARCHIVE));
    assert.ok(!caretakerScopes.includes(PermissionScopes.MEMBER_INVITE));
    assert.ok(!caretakerScopes.includes(PermissionScopes.MEMBER_REVOKE));

    // But CAN view and acknowledge doses
    assert.ok(caretakerScopes.includes(PermissionScopes.DOSE_ACKNOWLEDGE));
    assert.ok(caretakerScopes.includes(PermissionScopes.CARE_NOTE_CREATE));
  });

  await t.test('FAMILY_MEMBER cannot modify prescriptions or revoke members', () => {
    const memberScopes = DEFAULT_ROLE_SCOPES[Roles.FAMILY_MEMBER];
    assert.ok(!memberScopes.includes(PermissionScopes.MEDICATION_CREATE));
    assert.ok(!memberScopes.includes(PermissionScopes.MEDICATION_UPDATE));
    assert.ok(!memberScopes.includes(PermissionScopes.MEMBER_REVOKE));

    // Can view and acknowledge
    assert.ok(memberScopes.includes(PermissionScopes.DOSE_ACKNOWLEDGE));
    assert.ok(memberScopes.includes(PermissionScopes.AUDIT_VIEW));
  });

  await t.test('CARE_COORDINATOR has appointment and note permissions but cannot alter prescriptions', () => {
    const coordScopes = DEFAULT_ROLE_SCOPES[Roles.CARE_COORDINATOR];
    assert.ok(coordScopes.includes(PermissionScopes.APPOINTMENT_MANAGE));
    assert.ok(coordScopes.includes(PermissionScopes.CARE_NOTE_CREATE));
    assert.ok(!coordScopes.includes(PermissionScopes.MEDICATION_CREATE));
    assert.ok(!coordScopes.includes(PermissionScopes.MEDICATION_ARCHIVE));
  });
});
