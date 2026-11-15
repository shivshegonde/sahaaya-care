import { Router, Request, Response } from 'express';
import { requireAuth } from '../services/auth.js';
import {
  requirePermission,
  PermissionScopes
} from '../services/rbac.js';
import {
  createCareNote,
  getCareNotesForProfile,
  generateHandoverSummary
} from '../services/careNotes.js';

export const notesRouter = Router();

// ==========================================
// CARE NOTES & SMART HANDOVER
// ==========================================

notesRouter.get('/care-profiles/:profileId/notes', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const notes = getCareNotesForProfile(req.params.profileId);
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.post('/care-profiles/:profileId/notes', requireAuth, requirePermission(PermissionScopes.CARE_NOTE_CREATE), (req: Request, res: Response) => {
  try {
    const { body, category, visibility } = req.body;
    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Note content cannot be empty.' });
    }

    const note = createCareNote({
      careProfileId: req.params.profileId,
      body,
      category,
      visibility,
      userId: req.user!.id
    });

    res.status(201).json({ note });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notesRouter.get('/care-profiles/:profileId/handover', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), (req: Request, res: Response) => {
  try {
    const handover = generateHandoverSummary(req.params.profileId);
    res.json({ handover });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
