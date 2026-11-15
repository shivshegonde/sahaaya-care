import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { recordAuditEvent } from './audit.js';
import { DEFAULT_ROLE_SCOPES, RoleType, ScopeType } from './rbac.js';

export function hashInvitationCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function createInvitation(params: {
  careProfileId: string;
  email: string;
  role: RoleType;
  customScopes?: ScopeType[];
  createdByUserId: string;
  expiresInHours?: number;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  const rawCode = `SHY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const codeHash = hashInvitationCode(rawCode);
  const hours = params.expiresInHours || 48;
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const scopes = params.customScopes || DEFAULT_ROLE_SCOPES[params.role] || [];

  const stmt = db.prepare(`
    INSERT INTO invitations (
      id, care_profile_id, email, code_hash, role, permission_scopes,
      expires_at, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    params.careProfileId,
    params.email.toLowerCase().trim(),
    codeHash,
    params.role,
    JSON.stringify(scopes),
    expiresAt,
    params.createdByUserId,
    now
  );

  recordAuditEvent({
    careProfileId: params.careProfileId,
    actorUserId: params.createdByUserId,
    action: 'INVITATION_CREATED',
    entityType: 'INVITATION',
    entityId: id,
    afterSnapshot: {
      email: params.email,
      role: params.role,
      scopes,
      expiresAt
    },
    reason: `Invited ${params.email} as ${params.role}`
  });

  return {
    invitationId: id,
    rawCode, // Single time reveal for sharing via SMS/Email/UI
    expiresAt,
    role: params.role,
    email: params.email
  };
}

export function redeemInvitation(rawCode: string, authenticatedUserId: string, correlationId?: string) {
  const db = getDb();
  const codeHash = hashInvitationCode(rawCode);
  const now = new Date().toISOString();

  const invitation = db.prepare(`
    SELECT * FROM invitations WHERE code_hash = ?
  `).get(codeHash) as any;

  if (!invitation) {
    throw new Error('Invalid invitation code.');
  }

  if (invitation.redeemed_at) {
    throw new Error('This invitation has already been redeemed.');
  }

  if (invitation.revoked_at) {
    throw new Error('This invitation has been revoked by the care profile owner.');
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    throw new Error('This invitation code has expired. Please request a new invite.');
  }

  // Check if user is already a member
  const existingMembership = db.prepare(`
    SELECT id, status FROM care_memberships WHERE care_profile_id = ? AND user_id = ?
  `).get(invitation.care_profile_id, authenticatedUserId) as any;

  let membershipId = existingMembership?.id || crypto.randomUUID();

  if (existingMembership) {
    db.prepare(`
      UPDATE care_memberships
      SET role = ?, permissions = ?, status = 'ACTIVE', accepted_at = ?, revoked_at = NULL
      WHERE id = ?
    `).run(invitation.role, invitation.permission_scopes, now, existingMembership.id);
  } else {
    db.prepare(`
      INSERT INTO care_memberships (
        id, care_profile_id, user_id, role, permissions, status, invited_by, accepted_at
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `).run(
      membershipId,
      invitation.care_profile_id,
      authenticatedUserId,
      invitation.role,
      invitation.permission_scopes,
      invitation.created_by,
      now
    );
  }

  // Mark invitation redeemed
  db.prepare(`
    UPDATE invitations SET redeemed_at = ? WHERE id = ?
  `).run(now, invitation.id);

  recordAuditEvent({
    careProfileId: invitation.care_profile_id,
    actorUserId: authenticatedUserId,
    action: 'INVITATION_REDEEMED',
    entityType: 'CARE_MEMBERSHIP',
    entityId: membershipId,
    afterSnapshot: {
      invitationId: invitation.id,
      role: invitation.role,
      scopes: JSON.parse(invitation.permission_scopes)
    },
    reason: `User joined care circle as ${invitation.role}`,
    correlationId
  });

  return {
    careProfileId: invitation.care_profile_id,
    role: invitation.role,
    membershipId
  };
}

export function revokeMembership(careProfileId: string, targetUserId: string, actorUserId: string) {
  const db = getDb();
  const now = new Date().toISOString();

  const membership = db.prepare(`
    SELECT * FROM care_memberships WHERE care_profile_id = ? AND user_id = ?
  `).get(careProfileId, targetUserId) as any;

  if (!membership) {
    throw new Error('Membership not found.');
  }

  if (membership.role === 'ELDER_OWNER') {
    throw new Error('Cannot revoke access for the care profile owner.');
  }

  db.prepare(`
    UPDATE care_memberships SET status = 'REVOKED', revoked_at = ? WHERE id = ?
  `).run(now, membership.id);

  recordAuditEvent({
    careProfileId,
    actorUserId,
    action: 'MEMBER_REVOKED',
    entityType: 'CARE_MEMBERSHIP',
    entityId: membership.id,
    beforeSnapshot: { role: membership.role, status: membership.status },
    afterSnapshot: { status: 'REVOKED', revoked_at: now },
    reason: `Membership revoked by authorized user`
  });

  return { success: true };
}
