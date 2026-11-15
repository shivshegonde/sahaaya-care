import { Router, Request, Response } from 'express';
import {
  getDemoClockStatus,
  advanceSimulatedTime,
  resetSimulatedTime,
  runReminderDispatcher,
  fastForwardToNextDose,
  triggerGracePeriodExpiry
} from '../demo-clock.js';

export const demoRouter = Router();

// ==========================================
// DEMO CONTROLS (JUDGE SIMULATION RUNNER)
// ==========================================

demoRouter.get('/demo/clock', (_req: Request, res: Response) => {
  res.json(getDemoClockStatus());
});

demoRouter.post('/demo/advance-time', async (req: Request, res: Response) => {
  const { minutes, careProfileId } = req.body;
  const mins = parseInt(minutes || '30', 10);
  advanceSimulatedTime(mins);

  // Automatically trigger transition check and dispatcher
  const dispatchResult = await runReminderDispatcher(careProfileId);
  res.json({
    clock: getDemoClockStatus(),
    dispatchResult,
    message: dispatchResult.message || `Advanced time by +${mins} minutes.`
  });
});

demoRouter.post('/demo/reset-clock', (_req: Request, res: Response) => {
  resetSimulatedTime();
  res.json({
    clock: getDemoClockStatus(),
    message: 'Reset simulated clock back to real wall clock.'
  });
});

demoRouter.post('/demo/run-dispatcher', async (req: Request, res: Response) => {
  const { careProfileId } = req.body;
  const dispatchResult = await runReminderDispatcher(careProfileId);
  res.json({
    clock: getDemoClockStatus(),
    dispatchResult,
    message: dispatchResult.message || 'Evaluated schedules and reminder outbox.'
  });
});

demoRouter.post('/demo/fast-forward-next-dose', async (req: Request, res: Response) => {
  const { careProfileId } = req.body;
  const result = await fastForwardToNextDose(careProfileId);
  res.json(result);
});

demoRouter.post('/demo/trigger-grace-period-expiry', async (req: Request, res: Response) => {
  const { careProfileId } = req.body;
  const result = await triggerGracePeriodExpiry(careProfileId);
  res.json(result);
});
