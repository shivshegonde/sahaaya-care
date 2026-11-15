import { getDb } from '../db/database.js';

export interface AdherenceSummary {
  careProfileId: string;
  calculatedAt: string;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
  metrics: {
    totalEligiblePastDoses: number;
    acknowledgedTaken: number;
    acknowledgedSkipped: number;
    unableToTake: number;
    overdueUnconfirmed: number;
    adherenceRatePercentage: number;
  };
  dailyBreakdown: Array<{
    date: string;
    total: number;
    taken: number;
    skipped: number;
    unconfirmed: number;
  }>;
  methodology: {
    definition: string;
    disclaimer: string;
  };
}

export function calculateAdherence(careProfileId: string, days = 7): AdherenceSummary {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();

  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  startDate.setUTCHours(0, 0, 0, 0);
  const startIso = startDate.toISOString();

  // Only eligible past doses up to NOW, strictly excluding future doses
  const pastDoses = db.prepare(`
    SELECT id, scheduled_at_utc, local_scheduled_at, status
    FROM dose_instances
    WHERE care_profile_id = ?
      AND scheduled_at_utc >= ?
      AND scheduled_at_utc <= ?
      AND status != 'CANCELLED'
    ORDER BY scheduled_at_utc ASC
  `).all(careProfileId, startIso, nowIso) as any[];

  let taken = 0;
  let skipped = 0;
  let unable = 0;
  let unconfirmed = 0;

  const dayMap: Record<string, { total: number; taken: number; skipped: number; unconfirmed: number }> = {};

  // Initialize day buckets
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 3600 * 1000);
    const dayKey = d.toISOString().split('T')[0];
    dayMap[dayKey] = { total: 0, taken: 0, skipped: 0, unconfirmed: 0 };
  }

  for (const dose of pastDoses) {
    const dayKey = dose.scheduled_at_utc.split('T')[0];
    if (!dayMap[dayKey]) {
      dayMap[dayKey] = { total: 0, taken: 0, skipped: 0, unconfirmed: 0 };
    }

    dayMap[dayKey].total += 1;

    switch (dose.status) {
      case 'ACKNOWLEDGED_TAKEN':
        taken += 1;
        dayMap[dayKey].taken += 1;
        break;
      case 'ACKNOWLEDGED_SKIPPED':
        skipped += 1;
        dayMap[dayKey].skipped += 1;
        break;
      case 'UNABLE_TO_TAKE':
        unable += 1;
        dayMap[dayKey].skipped += 1;
        break;
      case 'OVERDUE_UNCONFIRMED':
      case 'DUE':
        unconfirmed += 1;
        dayMap[dayKey].unconfirmed += 1;
        break;
    }
  }

  const totalEligible = pastDoses.length;
  const adherenceRate = totalEligible > 0 ? Math.round((taken / totalEligible) * 1000) / 10 : 100;

  const dailyBreakdown = Object.entries(dayMap).map(([date, stats]) => ({
    date,
    ...stats
  }));

  return {
    careProfileId,
    calculatedAt: nowIso,
    dateRange: {
      start: startIso,
      end: nowIso,
      days
    },
    metrics: {
      totalEligiblePastDoses: totalEligible,
      acknowledgedTaken: taken,
      acknowledgedSkipped: skipped,
      unableToTake: unable,
      overdueUnconfirmed: unconfirmed,
      adherenceRatePercentage: adherenceRate
    },
    dailyBreakdown,
    methodology: {
      definition: 'Adherence % = (Acknowledged Taken Doses / Total Eligible Past Scheduled Doses) * 100. Future doses are excluded. Unconfirmed doses reduce adherence score.',
      disclaimer: 'This calculation reflects recorded user acknowledgements only and is not a clinical assessment, medical diagnosis, or guarantee of physiological compliance.'
    }
  };
}
