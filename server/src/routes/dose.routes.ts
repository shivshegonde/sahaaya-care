import { Router, Request, Response } from 'express';
import { requireAuth } from '../services/auth.js';
import {
  requirePermission,
  PermissionScopes,
  Roles,
  getUserMembership
} from '../services/rbac.js';
import {
  getDoseById,
  getTodayDosesForProfile,
  getDoseHistoryForProfile,
  acknowledgeDoseTaken,
  acknowledgeDoseSkipped,
  markDoseUnableToTake,
  correctDoseAcknowledgement
} from '../services/dose.js';
import { getSimulatedTime } from '../demo-clock.js';

export const doseRouter = Router();

// ==========================================
// DOSE TRACKING & ACKNOWLEDGEMENT
// ==========================================

doseRouter.get('/care-profiles/:profileId/doses/today', requireAuth, requirePermission(PermissionScopes.MEDICATION_VIEW), (req: Request, res: Response) => {
  try {
    const simTime = getSimulatedTime().toISOString();
    const doses = getTodayDosesForProfile(req.params.profileId, simTime);
    res.json({ doses, referenceTime: simTime });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doseRouter.get('/care-profiles/:profileId/doses/history', requireAuth, requirePermission(PermissionScopes.MEDICATION_VIEW), (req: Request, res: Response) => {
  try {
    const start = (req.query.start as string) || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const end = (req.query.end as string) || new Date().toISOString();
    const doses = getDoseHistoryForProfile(req.params.profileId, start, end);
    res.json({ doses, dateRange: { start, end } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doseRouter.post('/doses/:doseId/acknowledge', requireAuth, (req: Request, res: Response) => {
  try {
    const dose = getDoseById(req.params.doseId);
    if (!dose) return res.status(404).json({ error: 'Dose not found' });

    const membership = getUserMembership(dose.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.DOSE_ACKNOWLEDGE))) {
      return res.status(403).json({ error: 'Permission denied: Missing DOSE_ACKNOWLEDGE scope.' });
    }

    const updated = acknowledgeDoseTaken(req.params.doseId, req.user!.id, req.body.note);
    res.json({ dose: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doseRouter.post('/doses/:doseId/skip', requireAuth, (req: Request, res: Response) => {
  try {
    const dose = getDoseById(req.params.doseId);
    if (!dose) return res.status(404).json({ error: 'Dose not found' });

    const membership = getUserMembership(dose.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.DOSE_ACKNOWLEDGE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updated = acknowledgeDoseSkipped(req.params.doseId, req.user!.id, req.body.reason);
    res.json({ dose: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doseRouter.post('/doses/:doseId/unable-to-take', requireAuth, (req: Request, res: Response) => {
  try {
    const dose = getDoseById(req.params.doseId);
    if (!dose) return res.status(404).json({ error: 'Dose not found' });

    const membership = getUserMembership(dose.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.DOSE_ACKNOWLEDGE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updated = markDoseUnableToTake(req.params.doseId, req.user!.id, req.body.reason);
    res.json({ dose: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doseRouter.post('/doses/:doseId/correct-acknowledgement', requireAuth, (req: Request, res: Response) => {
  try {
    const { newStatus, reason } = req.body;
    if (!newStatus || !reason) {
      return res.status(400).json({ error: 'newStatus and reason are required to correct an acknowledgement.' });
    }

    const dose = getDoseById(req.params.doseId);
    if (!dose) return res.status(404).json({ error: 'Dose not found' });

    const membership = getUserMembership(dose.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.DOSE_ACKNOWLEDGE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updated = correctDoseAcknowledgement(req.params.doseId, req.user!.id, newStatus, reason);
    res.json({ dose: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
