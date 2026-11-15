import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, setDb } from '../../server/src/db/database.js';
import { chatWithAssistant, detectScheduleConflicts, executeAssistantTool } from '../../server/src/services/ai.js';

test('AI Assistant Safety Boundaries & Tool Calling', async (t) => {
  const db = getDb(':memory:');
  setDb(db);

  db.prepare(`
    INSERT INTO users (id, auth_subject, email, display_name, password_hash, created_at, updated_at)
    VALUES ('u-ai-elder', 'sub-ai', 'elder@test.local', 'Anita', 'h', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  db.prepare(`
    INSERT INTO care_profiles (id, owner_user_id, display_name, timezone, created_at, updated_at)
    VALUES ('cp-ai-profile', 'u-ai-elder', 'Anita Care Profile', 'Asia/Kolkata', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')
  `).run();

  await t.test('safety guardrail: urgent emergency keywords trigger immediate medical disclaimer', async () => {
    const res1 = await chatWithAssistant({
      userMessage: 'I am having sudden severe chest pain and cannot breathe',
      careProfileId: 'cp-ai-profile',
      userId: 'u-ai-elder'
    });

    assert.equal(res1.source, 'SAFETY_INTERVENTION');
    assert.ok(res1.reply.includes('URGENT'));
    assert.ok(res1.reply.includes('emergency medical services'));

    const res2 = await chatWithAssistant({
      userMessage: 'Patient took an accidental overdose of sleeping pills',
      careProfileId: 'cp-ai-profile',
      userId: 'u-ai-elder'
    });
    assert.equal(res2.source, 'SAFETY_INTERVENTION');
    assert.ok(res2.reply.includes('URGENT'));
  });

  await t.test('clinical guardrail: refuses to recommend double dosing or schedule alteration', async () => {
    const res = await chatWithAssistant({
      userMessage: 'I missed my morning dose, should I take two tablets now?',
      careProfileId: 'cp-ai-profile',
      userId: 'u-ai-elder'
    });

    assert.equal(res.source, 'CLINICAL_SAFETY_RULE');
    assert.ok(res.reply.includes('do not take a double dose'));
    assert.ok(res.reply.includes('consulting your doctor or pharmacist'));
  });

  await t.test('schedule conflict detector flags appointments coinciding with medication reminders', () => {
    const doses = [
      {
        medication_name: 'Metformin',
        local_scheduled_at: '2026-11-15T10:00:00',
        scheduled_at_utc: '2026-11-15T04:30:00.000Z'
      }
    ];

    const appointments = [
      {
        doctor_name: 'Dr. Kulkarni',
        facility_name: 'Apollo Clinic',
        starts_at_utc: '2026-11-15T04:45:00.000Z' // 15 mins apart!
      }
    ];

    const conflicts = detectScheduleConflicts(doses, appointments);
    assert.equal(conflicts.length, 1);
    assert.ok(conflicts[0].includes('Schedule proximity notice'));
  });

  await t.test('executeAssistantTool executes grounded tools accurately', async () => {
    const plan = await executeAssistantTool('get_today_care_plan', {}, 'cp-ai-profile', 'u-ai-elder');
    assert.equal(plan.profileName, 'Anita Care Profile');
    assert.ok(Array.isArray(plan.dosesToday));

    const adherence = await executeAssistantTool('get_adherence_summary', {}, 'cp-ai-profile', 'u-ai-elder');
    assert.ok(adherence);

    const members = await executeAssistantTool('get_authorized_care_members', {}, 'cp-ai-profile', 'u-ai-elder');
    assert.ok(members.activeCircleMembers !== undefined);

    const notes = await executeAssistantTool('get_recent_care_notes', {}, 'cp-ai-profile', 'u-ai-elder');
    assert.ok(Array.isArray(notes.recentNotes));

    const proposal = await executeAssistantTool('propose_medication_change', {
      medicationName: 'Metformin',
      summary: 'Change timing to 08:00 AM'
    }, 'cp-ai-profile', 'u-ai-elder');
    assert.equal(proposal.status, 'PROPOSAL_CREATED');
    assert.equal(proposal.requiresConfirmation, true);
  });
});
