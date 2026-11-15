import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { requireAuth } from '../services/auth.js';
import {
  requirePermission,
  PermissionScopes,
  getUserMembership
} from '../services/rbac.js';
import {
  chatWithAssistant,
  generateDailyBriefing
} from '../services/ai.js';
import { recordAuditEvent } from '../services/audit.js';

export const aiRouter = Router();

// ==========================================
// GROUNDED AI ASSISTANT & DAILY BRIEFING
// ==========================================

aiRouter.post('/assistant/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, careProfileId } = req.body;
    if (!message || !careProfileId) {
      return res.status(400).json({ error: 'message and careProfileId are required.' });
    }

    const membership = getUserMembership(careProfileId, req.user!.id);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied: Not a member of this care profile.' });
    }

    const response = await chatWithAssistant({
      userMessage: message,
      careProfileId,
      userId: req.user!.id
    });

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiRouter.get('/assistant/briefing/:profileId', requireAuth, requirePermission(PermissionScopes.PROFILE_VIEW), async (req: Request, res: Response) => {
  try {
    const briefing = await generateDailyBriefing(req.params.profileId);
    res.json({ briefing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

aiRouter.post('/assistant/actions/:actionId/confirm', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const action = db.prepare('SELECT * FROM assistant_actions WHERE id = ?').get(req.params.actionId) as any;
    if (!action) return res.status(404).json({ error: 'Assistant action not found.' });

    const membership = getUserMembership(action.care_profile_id, req.user!.id);
    if (!membership) return res.status(403).json({ error: 'Access denied' });

    const now = new Date().toISOString();
    db.prepare('UPDATE assistant_actions SET status = ?, executed_at = ? WHERE id = ?').run('EXECUTED', now, action.id);

    recordAuditEvent({
      careProfileId: action.care_profile_id,
      actorUserId: req.user!.id,
      action: 'AI_PROPOSAL_CONFIRMED',
      entityType: 'ASSISTANT_ACTION',
      entityId: action.id,
      reason: `User confirmed proposal: ${action.summary}`
    });

    res.json({ success: true, message: 'Proposed action confirmed and recorded.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
