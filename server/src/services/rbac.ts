import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.js';

export const Roles = {
  ELDER_OWNER: 'ELDER_OWNER',
  FAMILY_ADMIN: 'FAMILY_ADMIN',
  FAMILY_MEMBER: 'FAMILY_MEMBER',
  CARETAKER: 'CARETAKER',
  CARE_COORDINATOR: 'CARE_COORDINATOR'
} as const;

export type RoleType = (typeof Roles)[keyof typeof Roles];

export const PermissionScopes = {
  PROFILE_VIEW: 'PROFILE_VIEW',
  MEDICATION_VIEW: 'MEDICATION_VIEW',
  MEDICATION_CREATE: 'MEDICATION_CREATE',
  MEDICATION_UPDATE: 'MEDICATION_UPDATE',
  MEDICATION_ARCHIVE: 'MEDICATION_ARCHIVE',
  DOSE_ACKNOWLEDGE: 'DOSE_ACKNOWLEDGE',
  APPOINTMENT_VIEW: 'APPOINTMENT_VIEW',
  APPOINTMENT_MANAGE: 'APPOINTMENT_MANAGE',
  CARE_NOTE_CREATE: 'CARE_NOTE_CREATE',
  MEMBER_INVITE: 'MEMBER_INVITE',
  MEMBER_REVOKE: 'MEMBER_REVOKE',
  AUDIT_VIEW: 'AUDIT_VIEW'
} as const;

export type ScopeType = (typeof PermissionScopes)[keyof typeof PermissionScopes];

export const DEFAULT_ROLE_SCOPES: Record<RoleType, ScopeType[]> = {
  ELDER_OWNER: Object.values(PermissionScopes),
  FAMILY_ADMIN: [
    PermissionScopes.PROFILE_VIEW,
    PermissionScopes.MEDICATION_VIEW,
    PermissionScopes.MEDICATION_CREATE,
    PermissionScopes.MEDICATION_UPDATE,
    PermissionScopes.MEDICATION_ARCHIVE,
    PermissionScopes.DOSE_ACKNOWLEDGE,
    PermissionScopes.APPOINTMENT_VIEW,
    PermissionScopes.APPOINTMENT_MANAGE,
    PermissionScopes.CARE_NOTE_CREATE,
    PermissionScopes.MEMBER_INVITE,
    PermissionScopes.AUDIT_VIEW
  ],
  FAMILY_MEMBER: [
    PermissionScopes.PROFILE_VIEW,
    PermissionScopes.MEDICATION_VIEW,
    PermissionScopes.DOSE_ACKNOWLEDGE,
    PermissionScopes.APPOINTMENT_VIEW,
    PermissionScopes.CARE_NOTE_CREATE,
    PermissionScopes.AUDIT_VIEW
  ],
  CARETAKER: [
    PermissionScopes.PROFILE_VIEW,
    PermissionScopes.MEDICATION_VIEW,
    PermissionScopes.DOSE_ACKNOWLEDGE,
    PermissionScopes.APPOINTMENT_VIEW,
    PermissionScopes.CARE_NOTE_CREATE
  ],
  CARE_COORDINATOR: [
    PermissionScopes.PROFILE_VIEW,
    PermissionScopes.MEDICATION_VIEW,
    PermissionScopes.APPOINTMENT_VIEW,
    PermissionScopes.APPOINTMENT_MANAGE,
    PermissionScopes.CARE_NOTE_CREATE,
    PermissionScopes.AUDIT_VIEW
  ]
};

export interface MembershipRecord {
  id: string;
  care_profile_id: string;
  user_id: string;
  role: RoleType;
  permissions: string[];
  status: 'ACTIVE' | 'REVOKED';
}

export function getUserMembership(careProfileId: string, userId: string): MembershipRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, care_profile_id, user_id, role, permissions, status
    FROM care_memberships
    WHERE care_profile_id = ? AND user_id = ? AND status = 'ACTIVE'
  `).get(careProfileId, userId) as any;

  if (!row) return null;

  let permissions: string[] = [];
  try {
    permissions = JSON.parse(row.permissions);
  } catch {
    permissions = [];
  }

  return {
    id: row.id,
    care_profile_id: row.care_profile_id,
    user_id: row.user_id,
    role: row.role as RoleType,
    permissions,
    status: row.status
  };
}

export function hasPermission(membership: MembershipRecord | null, scope: ScopeType): boolean {
  if (!membership || membership.status !== 'ACTIVE') return false;
  if (membership.role === Roles.ELDER_OWNER) return true;
  return membership.permissions.includes(scope);
}

export function requirePermission(scope: ScopeType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const profileId = req.params.profileId || (req.body && req.body.care_profile_id) || req.query.profileId;
    if (!profileId || typeof profileId !== 'string') {
      res.status(400).json({ error: 'Care profile ID parameter is required' });
      return;
    }

    const membership = getUserMembership(profileId, req.user.id);
    if (!membership) {
      res.status(403).json({
        error: 'Access denied: You are not an active member of this care profile.'
      });
      return;
    }

    if (!hasPermission(membership, scope)) {
      res.status(403).json({
        error: `Access denied: Missing required permission scope [${scope}]. Role: ${membership.role}`,
        requiredScope: scope,
        currentRole: membership.role
      });
      return;
    }

    next();
  };
}
