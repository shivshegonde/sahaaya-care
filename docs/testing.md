# Sahaaya Care — Testing Strategy & Quality Gates

## 1. Test Architecture

The platform includes automated unit tests, integration tests, and security isolation tests executed via Node's native test runner (`node:test` and `node:assert`).

```bash
# Execute entire test suite
npm test
```

## 2. Test Coverage Matrix

| Test Suite | File | Verified Capabilities |
|---|---|---|
| **Medication Recurrence Engine** | `tests/unit/medication-recurrence.test.ts` | • Exact dose text preservation.<br>• Recurrence generation for 7 and 14 days.<br>• Idempotency key deduplication (prevents duplicate doses). |
| **Dose State Machine & Grace Period** | `tests/unit/dose-state-machine.test.ts` | • `UPCOMING` → `DUE` transition.<br>• `DUE` → `OVERDUE_UNCONFIRMED` transition after 30-min grace period.<br>• Dose acknowledgement with actor and timestamp.<br>• Dose correction requiring mandatory audit reason. |
| **Adherence Analytics Calculation** | `tests/unit/adherence-calculation.test.ts` | • Strict exclusion of future scheduled doses.<br>• Accurate percentage calculation.<br>• Unconfirmed doses correctly penalize adherence.<br>• Inclusion of methodology disclaimer. |
| **Security & Profile Isolation** | `tests/security/cross-profile-isolation.test.ts` | • Cross-profile isolation: Uninvited user B cannot view Profile A.<br>• Role gating: Caretaker cannot modify prescriptions.<br>• Single-use invitation redemption: Prevents code reuse.<br>• Immediate revocation: Revoked member cannot read or mutate data. |
| **AI Safety & Clinical Guardrails** | `tests/integration/ai-safety.test.ts` | • Emergency symptoms trigger instant emergency guidance.<br>• Refusal to suggest double doses or timing changes.<br>• Proximity conflict detector flags appointment collisions. |

## 3. Actual Test Results

```text
▶ AI Assistant Safety Boundaries & Tool Calling
  ✔ safety guardrail: urgent emergency keywords trigger immediate medical disclaimer
  ✔ clinical guardrail: refuses to recommend double dosing or schedule alteration
  ✔ schedule conflict detector flags appointments coinciding with medication reminders
✔ AI Assistant Safety Boundaries & Tool Calling

▶ Security & Profile Isolation Enforcement
  ✔ threat 1: uninvited user B is completely blocked from care profile A
  ✔ threat 2: caretaker C cannot edit medication without MEDICATION_UPDATE scope
  ✔ threat 3: invitation tokens cannot be reused once redeemed
  ✔ threat 4: revoked member immediately loses all access
✔ Security & Profile Isolation Enforcement

▶ Adherence Analytics Engine
  ✔ strictly excludes future doses and calculates accurate percentage
✔ Adherence Analytics Engine

▶ Dose State Machine & Escalation Grace Period
  ✔ dose is initially UPCOMING
  ✔ transitions UPCOMING -> DUE when reference time reaches scheduled time
  ✔ transitions DUE -> OVERDUE_UNCONFIRMED after 30 min grace period passes without acknowledgement
  ✔ acknowledging taken updates status, actor, and timestamp
  ✔ correcting dose acknowledgement requires reason and preserves history
✔ Dose State Machine & Escalation Grace Period

▶ Medication & Recurrence Engine
  ✔ creates medication with exact prescribed dose text without alteration
  ✔ generates dose instances idempotently without duplicate insertions
✔ Medication & Recurrence Engine

ℹ tests 20
ℹ suites 0
ℹ pass 20
ℹ fail 0
```
