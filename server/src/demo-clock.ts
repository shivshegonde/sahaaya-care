import { getDb } from './db/database.js';
import { evaluateDoseTransitions } from './services/dose.js';
import { getPendingOutboxEvents, markOutboxEventPublished, incrementOutboxAttempt } from './services/outbox.js';
import { dispatchNotification } from './services/notification.js';

let simulatedTimeOffsetMs = 0;

export function getSimulatedTime(): Date {
  return new Date(Date.now() + simulatedTimeOffsetMs);
}

export function advanceSimulatedTime(minutes: number) {
  simulatedTimeOffsetMs += minutes * 60 * 1000;
  return getSimulatedTime();
}

export function resetSimulatedTime() {
  simulatedTimeOffsetMs = 0;
  return getSimulatedTime();
}

export function setSimulatedTime(targetDateIso: string) {
  const target = new Date(targetDateIso).getTime();
  simulatedTimeOffsetMs = target - Date.now();
  return getSimulatedTime();
}

export function getDemoClockStatus() {
  const sim = getSimulatedTime();
  const real = new Date();
  return {
    realTime: real.toISOString(),
    simulatedTime: sim.toISOString(),
    offsetMinutes: Math.round(simulatedTimeOffsetMs / 60000),
    isOffsetActive: simulatedTimeOffsetMs !== 0
  };
}

// Background or manual runner that scans due doses and processes outbox with concurrency guard
let isDispatching = false;

export async function runReminderDispatcher(careProfileId?: string) {
  if (isDispatching) {
    return {
      dispatchedCount: 0,
      simulatedTime: getSimulatedTime().toISOString(),
      skippedDueToConcurrency: true,
      message: 'Dispatcher currently running in background.',
      results: []
    };
  }

  isDispatching = true;
  try {
    const db = getDb();
    const simNow = getSimulatedTime().toISOString();

    const profilesToScan = careProfileId
      ? [{ id: careProfileId }]
      : (db.prepare('SELECT id FROM care_profiles').all() as any[]);

    let totalDue = 0;
    let totalOverdue = 0;
    const transitionedDetails: any[] = [];

    for (const p of profilesToScan) {
      const res = evaluateDoseTransitions(p.id, simNow);
      totalDue += res.dueTransitionsCount;
      totalOverdue += res.overdueTransitionsCount;
      transitionedDetails.push(...res.transitionedDoses);
    }

    // Process outbox events
    const pendingEvents = getPendingOutboxEvents(50);
    const results = [];

    for (const event of pendingEvents) {
      try {
        const outcome = await dispatchNotification({
          careProfileId: event.payload.careProfileId,
          eventType: event.event_type as any,
          entityType: 'DOSE',
          entityId: event.aggregate_id,
          scheduledFor: event.payload.scheduledAt || simNow,
          metadata: event.payload
        });
        markOutboxEventPublished(event.id);
        results.push({ eventId: event.id, outcome });
      } catch (err: any) {
        incrementOutboxAttempt(event.id);
        results.push({ eventId: event.id, error: err.message });
      }
    }

    // Find next upcoming dose in schedule for guidance
    const nextUpcoming = db.prepare(`
      SELECT d.*, m.name as medication_name, m.dose_text
      FROM dose_instances d
      JOIN medications m ON d.medication_id = m.id
      WHERE (? IS NULL OR d.care_profile_id = ?)
        AND d.status = 'UPCOMING'
      ORDER BY d.scheduled_at_utc ASC
      LIMIT 1
    `).get(careProfileId || null, careProfileId || null) as any;

    let message = '';
    if (results.length > 0) {
      message = `🔔 Dispatched ${results.length} notification(s)! Evaluated schedules: ${totalDue} now DUE, ${totalOverdue} OVERDUE.`;
    } else if (totalDue > 0 || totalOverdue > 0) {
      message = `Evaluated schedules: ${totalDue} dose(s) transitioned to DUE, ${totalOverdue} to OVERDUE.`;
    } else if (nextUpcoming) {
      const timeStr = nextUpcoming.local_scheduled_at?.split('T')[1]?.slice(0, 5) || 'later today';
      message = `Checked schedules: 0 pending due reminders right now. Next scheduled dose: ${nextUpcoming.medication_name} at ${timeStr}. (Tip: Click "Jump to Next Dose" to simulate!)`;
    } else {
      message = 'All scheduled doses for this care profile have already been taken or acknowledged.';
    }

    return {
      dispatchedCount: results.length,
      simulatedTime: simNow,
      totalDue,
      totalOverdue,
      transitionedDetails,
      nextUpcomingDose: nextUpcoming,
      message,
      results
    };
  } finally {
    isDispatching = false;
  }
}

// Fast-forward simulated clock to the exact time of the next scheduled dose
export async function fastForwardToNextDose(careProfileId?: string) {
  const db = getDb();
  const simNow = getSimulatedTime().toISOString();

  // Find the next upcoming dose in chronological order
  const nextDose = db.prepare(`
    SELECT d.*, m.name as medication_name, m.dose_text
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    WHERE (? IS NULL OR d.care_profile_id = ?)
      AND d.status = 'UPCOMING'
    ORDER BY d.scheduled_at_utc ASC
    LIMIT 1
  `).get(careProfileId || null, careProfileId || null) as any;

  if (!nextDose) {
    return {
      success: false,
      message: 'No upcoming doses found. All scheduled doses have already been acknowledged or are due.',
      clock: getDemoClockStatus()
    };
  }

  // Jump simulated time to the exact scheduled time of this dose
  setSimulatedTime(nextDose.scheduled_at_utc);
  const updatedSimTime = getSimulatedTime().toISOString();

  // Run transitions and dispatcher
  const transitions = evaluateDoseTransitions(nextDose.care_profile_id, updatedSimTime);
  const dispatchResult = await runReminderDispatcher(nextDose.care_profile_id);

  const localTimeFormatted = nextDose.local_scheduled_at?.split('T')[1]?.slice(0, 5) || 'scheduled time';

  return {
    success: true,
    message: `⚡ Fast-forwarded clock to ${localTimeFormatted}: ${nextDose.medication_name} (${nextDose.dose_text}) is now DUE NOW! Reminder notification queued.`,
    clock: getDemoClockStatus(),
    dose: nextDose,
    transitions,
    dispatchResult
  };
}

// Fast-forward clock past the grace period for the active dose to trigger escalation
export async function triggerGracePeriodExpiry(careProfileId?: string) {
  const db = getDb();

  // Look for a dose that is currently DUE
  let targetDose = db.prepare(`
    SELECT d.*, m.name as medication_name, m.dose_text, cp.grace_period_minutes
    FROM dose_instances d
    JOIN medications m ON d.medication_id = m.id
    JOIN care_profiles cp ON d.care_profile_id = cp.id
    WHERE (? IS NULL OR d.care_profile_id = ?)
      AND d.status = 'DUE'
    ORDER BY d.scheduled_at_utc ASC
    LIMIT 1
  `).get(careProfileId || null, careProfileId || null) as any;

  // If no dose is DUE, find the earliest UPCOMING dose
  if (!targetDose) {
    targetDose = db.prepare(`
      SELECT d.*, m.name as medication_name, m.dose_text, cp.grace_period_minutes
      FROM dose_instances d
      JOIN medications m ON d.medication_id = m.id
      JOIN care_profiles cp ON d.care_profile_id = cp.id
      WHERE (? IS NULL OR d.care_profile_id = ?)
        AND d.status = 'UPCOMING'
      ORDER BY d.scheduled_at_utc ASC
      LIMIT 1
    `).get(careProfileId || null, careProfileId || null) as any;
  }

  if (!targetDose) {
    return {
      success: false,
      message: 'No active or upcoming doses found to escalate.',
      clock: getDemoClockStatus()
    };
  }

  const grace = targetDose.grace_period_minutes || 30;
  // Advance to scheduled_at_utc + grace + 2 minutes
  const expiryDate = new Date(new Date(targetDose.scheduled_at_utc).getTime() + (grace + 2) * 60 * 1000);
  setSimulatedTime(expiryDate.toISOString());

  const updatedSimTime = getSimulatedTime().toISOString();
  const transitions = evaluateDoseTransitions(targetDose.care_profile_id, updatedSimTime);
  const dispatchResult = await runReminderDispatcher(targetDose.care_profile_id);

  return {
    success: true,
    message: `⚠️ Fast-forwarded past the ${grace}-minute grace period: ${targetDose.medication_name} transitioned to OVERDUE_UNCONFIRMED! Escalation alert dispatched to family contact.`,
    clock: getDemoClockStatus(),
    dose: targetDose,
    transitions,
    dispatchResult
  };
}
