import { Router, Request, Response } from 'express';
import { requireAuth } from '../services/auth.js';
import {
  requirePermission,
  PermissionScopes,
  Roles,
  getUserMembership
} from '../services/rbac.js';
import {
  createMedication,
  getMedicationById,
  getMedicationsForProfile,
  updateMedication,
  setMedicationStatus
} from '../services/medication.js';

export const medicationRouter = Router();

// ==========================================
// MEDICATION MANAGEMENT & SCHEDULE
// ==========================================

medicationRouter.get('/care-profiles/:profileId/medications', requireAuth, requirePermission(PermissionScopes.MEDICATION_VIEW), (req: Request, res: Response) => {
  try {
    const meds = getMedicationsForProfile(req.params.profileId);
    res.json({ medications: meds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

medicationRouter.post('/care-profiles/:profileId/medications', requireAuth, requirePermission(PermissionScopes.MEDICATION_CREATE), (req: Request, res: Response) => {
  try {
    const { name, brandName, doseText, form, route, instructions, scheduleType, scheduleConfig, startDate, endDate, prescriber } = req.body;
    if (!name || !doseText || !form || !scheduleType || !startDate) {
      res.status(400).json({ error: 'Missing required medication fields: name, doseText, form, scheduleType, startDate.' });
      return;
    }

    const med = createMedication({
      careProfileId: req.params.profileId,
      name,
      brandName,
      doseText,
      form,
      route,
      instructions,
      scheduleType,
      scheduleConfig: scheduleConfig || { times: ['09:00'] },
      startDate,
      endDate,
      prescriber,
      userId: req.user!.id
    });

    res.status(201).json({ medication: med });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

medicationRouter.get('/medications/:medicationId', requireAuth, (req: Request, res: Response) => {
  try {
    const med = getMedicationById(req.params.medicationId);
    if (!med) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    const membership = getUserMembership(med.care_profile_id, req.user!.id);
    if (!membership) {
      res.status(403).json({ error: 'Access denied to this medication profile.' });
      return;
    }
    res.json({ medication: med });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

medicationRouter.patch('/medications/:medicationId', requireAuth, (req: Request, res: Response) => {
  try {
    const med = getMedicationById(req.params.medicationId);
    if (!med) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    const membership = getUserMembership(med.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.MEDICATION_UPDATE))) {
      res.status(403).json({ error: 'Permission denied: Missing MEDICATION_UPDATE scope.' });
      return;
    }

    const updated = updateMedication(req.params.medicationId, req.body, req.user!.id);
    res.json({ medication: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

medicationRouter.post('/medications/:medicationId/pause', requireAuth, (req: Request, res: Response) => {
  try {
    const med = getMedicationById(req.params.medicationId);
    if (!med) return res.status(404).json({ error: 'Medication not found' });
    const membership = getUserMembership(med.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.MEDICATION_UPDATE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const result = setMedicationStatus(req.params.medicationId, 'PAUSED', req.user!.id);
    res.json({ medication: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

medicationRouter.post('/medications/:medicationId/archive', requireAuth, (req: Request, res: Response) => {
  try {
    const med = getMedicationById(req.params.medicationId);
    if (!med) return res.status(404).json({ error: 'Medication not found' });
    const membership = getUserMembership(med.care_profile_id, req.user!.id);
    if (!membership || (membership.role !== Roles.ELDER_OWNER && !membership.permissions.includes(PermissionScopes.MEDICATION_ARCHIVE))) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const result = setMedicationStatus(req.params.medicationId, 'ARCHIVED', req.user!.id);
    res.json({ medication: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
