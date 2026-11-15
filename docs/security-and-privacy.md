# Sahaaya Care — Security, Privacy, and Consent Framework

## 1. Security Architecture Principles

### Zero Trust in Frontend & AI
All authorization boundaries are strictly enforced in the backend service and database layers. Identity is derived exclusively from verified JWT authentication tokens and database membership records. Frontend client claims and AI model text generation are treated as untrusted inputs.

### Least Privilege Role-Based Access Control (RBAC)
Every request is scoped to a specific care profile and verified against granular permission scopes:

| Role | Default Permissions | Description |
|---|---|---|
| `ELDER_OWNER` | All scopes (`PROFILE_VIEW`, `MEDICATION_VIEW`, `MEDICATION_CREATE`, `MEDICATION_UPDATE`, `MEDICATION_ARCHIVE`, `DOSE_ACKNOWLEDGE`, `APPOINTMENT_VIEW`, `APPOINTMENT_MANAGE`, `CARE_NOTE_CREATE`, `MEMBER_INVITE`, `MEMBER_REVOKE`, `AUDIT_VIEW`) | The elderly person who owns the care profile and has complete authority to invite, grant, or revoke access. |
| `FAMILY_ADMIN` | `PROFILE_VIEW`, `MEDICATION_VIEW`, `MEDICATION_CREATE`, `MEDICATION_UPDATE`, `MEDICATION_ARCHIVE`, `DOSE_ACKNOWLEDGE`, `APPOINTMENT_VIEW`, `APPOINTMENT_MANAGE`, `CARE_NOTE_CREATE`, `MEMBER_INVITE`, `AUDIT_VIEW` | Trusted family member authorized to help manage prescriptions and appointments. |
| `FAMILY_MEMBER` | `PROFILE_VIEW`, `MEDICATION_VIEW`, `DOSE_ACKNOWLEDGE`, `APPOINTMENT_VIEW`, `CARE_NOTE_CREATE`, `AUDIT_VIEW` | Family member with visibility into adherence and care notes; cannot edit medication instructions. |
| `CARETAKER` | `PROFILE_VIEW`, `MEDICATION_VIEW`, `DOSE_ACKNOWLEDGE`, `APPOINTMENT_VIEW`, `CARE_NOTE_CREATE` | Care assistant; can record care observations and dose assistance. **Cannot alter prescriptions or invite members.** |
| `CARE_COORDINATOR` | `PROFILE_VIEW`, `MEDICATION_VIEW`, `APPOINTMENT_VIEW`, `APPOINTMENT_MANAGE`, `CARE_NOTE_CREATE`, `AUDIT_VIEW` | Visiting nurse or clinical coordinator; coordinates appointments and reviews logs. |

## 2. Threat Modeling & Defense Verification

1. **Cross-Profile Data Leaks**: Every SQL query filters by `care_profile_id` after verifying active membership. User A cannot view User B's medications, appointments, or doses (Verified in `tests/security/cross-profile-isolation.test.ts`).
2. **Unauthorized Medication Modifications**: Caretakers and general family members are denied `MEDICATION_UPDATE` and `MEDICATION_ARCHIVE` privileges by middleware.
3. **Invitation Passcode Replay Attacks**: Codes are single-use, cryptographically hashed with SHA-256 before storage, and enforce expiration. Reusing a redeemed passcode is blocked with an HTTP 400 error.
4. **Session Reuse After Revocation**: When an owner revokes a member, `care_memberships.status` is set to `REVOKED`. All subsequent API requests immediately fail with HTTP 403 Forbidden.
5. **Prompt Injection & AI Boundary Violations**: User-entered notes and messages are treated as untrusted data. The Gemini system instruction explicitly instructs the model to ignore meta-instructions in user input and never disclose information from other profiles.
6. **Notification Redelivery**: Idempotency keys prevent duplicate emails even during network retries or message redelivery.

## 3. Privacy & Clinical Safety

- **No Diagnostic or Prescriptive Claims**: Sahaaya Care is a coordination platform. It does not calculate dosages, suggest alternative drugs, or interpret physiological symptoms.
- **Explainable Language**: Missing acknowledgements are labeled as *"No acknowledgement was recorded"* rather than accusing the individual of failing to take medication.
- **Auditability**: Sensitive mutations (acknowledgements, corrections, schedule changes, revocations) produce immutable records in `audit_events`.
