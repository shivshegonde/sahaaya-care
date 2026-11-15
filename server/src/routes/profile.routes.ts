import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { requireAuth } from '../services/auth.js';
import {
  requirePermission,
  PermissionScopes,
  DEFAULT_ROLE_SCOPES,
  getUserMembership
} from '../services/rbac.js';
import {
  createInvitation,
  redeemInvitation,
  revokeMembership
} from '../services/invitation.js';
import { calculateAdherence } from '../services/adherence.js';
import { getDeliveriesForProfile } from '../services/email.js';
import { getAuditEvents, recordAuditEvent } from '../services/audit.js';

export const profileRouter = Router();

// ==========================================
// CARE PROFILES & MEMBERSHIP
// ==========================================

profileRouter.post('/care-profiles', requireAuth, (req: Request, res: Response) => {
  try {
    const { displayName, timezone, preferredLanguage, gracePeriodMinutes } = req.body;
    if (!displayName) {
      res.status(400).json({ error: 'Profile display name is required.' });
      return;
    }

    const db = getDb();
    const profileId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, preferred_language, grace_period_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      req.user!.id,
      displayName.trim(),
      timezone || 'Asia/Kolkata',
      preferredLanguage || 'en',
      gracePeriodMinutes || 30,
      now,
      now
    );

    // Automatically make creator ELDER_OWNER
    db.prepare(`
      INSERT INTO care_memberships (id, care_profile_id, user_id, role, permissions, status, accepted_at)
      VALUES (?, ?, ?, 'ELDER_OWNER', ?, 'ACTIVE', ?)
    `).run(
      membershipId,
      profileId,
      req.user!.id,
      JSON.stringify(DEFAULT_ROLE_SCOPES.ELDER_OWNER),
      now
    );

    recordAuditEvent({
      careProfileId: profileId,
      actorUserId: req.user!.id,
      action: 'CARE_PROFILE_CREATED',
      entityType: 'CARE_PROFILE',
      entityId: profileId,
      reason: `Created care profile for ${displayName}`
    });

    res.status(201).json({ id: profileId, displayName, ownerUserId: req.user!.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

profileRouter.get('/care-profiles', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT cp.*, cm.role, cm.permissions, cm.status as membership_status
      FROM care_profiles cp
      JOIN care_memberships cm ON cp.id = cm.care_profile_id
      WHERE cm.user_id = ? AND cm.status = 'ACTIVE'
      ORDER BY cp.created_at DESC
    `).all(req.user!.id) as any[];

    res.json({
      profiles: rows.map(r => ({
        ...r,
        permissions: JSON.parse(r.permissions)
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

profileRouter.get('/care-profiles/:profileId', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const profile = db.prepare(`SELECT * FROM care_profiles WHERE id = ?`).get(req.params.profileId) as any;
    if (!profile) {
      res.status(404).json({ error: 'Care profile not found' });
      return;
    }
    const membership = getUserMembership(req.params.profileId, req.user!.id);
    res.json({ profile, membership });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

profileRouter.patch('/care-profiles/:profileId', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const { displayName, timezone, gracePeriodMinutes } = req.body;
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE care_profiles
      SET display_name = COALESCE(?, display_name),
          timezone = COALESCE(?, timezone),
          grace_period_minutes = COALESCE(?, grace_period_minutes),
          updated_at = ?
      WHERE id = ?
    `).run(
      displayName || null,
      timezone || null,
      gracePeriodMinutes || null,
      now,
      req.params.profileId
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

profileRouter.get('/care-profiles/:profileId/members', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT cm.*, u.email, u.display_name, u.role_title
      FROM care_memberships cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.care_profile_id = ?
      ORDER BY cm.role = 'ELDER_OWNER' DESC, cm.accepted_at ASC
    `).all(req.params.profileId) as any[];

    const invitations = db.prepare(`
      SELECT id, email, role, permission_scopes, expires_at, created_at, redeemed_at, revoked_at
      FROM invitations
      WHERE care_profile_id = ? AND redeemed_at IS NULL AND revoked_at IS NULL
    `).all(req.params.profileId) as any[];

    res.json({
      members: rows.map(r => ({
        ...r,
        permissions: JSON.parse(r.permissions)
      })),
      pendingInvitations: invitations.map(i => ({
        ...i,
        permission_scopes: JSON.parse(i.permission_scopes)
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// INVITATIONS & ACCESS CONTROL
// ==========================================

profileRouter.post('/care-profiles/:profileId/invitations', requireAuth, requirePermission(PermissionScopes.MEMBER_INVITE), (req: Request, res: Response) => {
  try {
    const { email, role, customScopes, expiresInHours } = req.body;
    if (!email || !role) {
      res.status(400).json({ error: 'Email and role are required for invitation.' });
      return;
    }

    const invitation = createInvitation({
      careProfileId: req.params.profileId,
      email,
      role,
      customScopes,
      createdByUserId: req.user!.id,
      expiresInHours
    });

    res.status(201).json(invitation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

profileRouter.post('/invitations/redeem', requireAuth, (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Invitation passcode is required.' });
      return;
    }

    const result = redeemInvitation(code, req.user!.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

profileRouter.delete('/care-profiles/:profileId/members/:memberUserId', requireAuth, requirePermission(PermissionScopes.MEMBER_REVOKE), (req: Request, res: Response) => {
  try {
    revokeMembership(req.params.profileId, req.params.memberUserId, req.user!.id);
    res.json({ success: true, message: 'Membership revoked successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// ADHERENCE ANALYTICS
// ==========================================

profileRouter.get('/care-profiles/:profileId/adherence', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || '7', 10);
    const adherence = calculateAdherence(req.params.profileId, days);
    res.json(adherence);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// NOTIFICATIONS AUDIT INSPECTOR
// ==========================================

profileRouter.get('/care-profiles/:profileId/notifications', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const deliveries = getDeliveriesForProfile(req.params.profileId);
    res.json({ deliveries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AUDIT TIMELINE
// ==========================================

profileRouter.get('/care-profiles/:profileId/audit', requireAuth, requirePermission(PermissionScopes.AUDIT_VIEW), (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const events = getAuditEvents(req.params.profileId, limit, offset);
    res.json({ auditEvents: events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
