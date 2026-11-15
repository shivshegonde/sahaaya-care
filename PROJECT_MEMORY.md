# PROJECT_MEMORY.md — State & Milestone Log

## Project Overview
- **Name**: Sahaaya Care
- **Hackathon**: Catalyst PromptSwar — Elderly Care & Medication Management Platform
- **GCP Project**: `ai-builder-sql-copilot`
- **Region**: `asia-south1`
- **Stack**: Node.js v24 (TypeScript + Express + built-in SQLite engine + PG connector), React 18 (Vite + Tailwind CSS), Google Gemini API (`gemini-3.8-flash` active with verified billing), transactional Outbox engine.

## Environment Discovery Status
- Node v24.21.0 & npm 11.19.0 detected.
- Google Cloud SDK 591.0.0 installed.
- Service Account: `sql-copilot-sa@ai-builder-sql-copilot.iam.gserviceaccount.com` (from `donotpush/gcp-key.json`).
- Gemini API verified active and live (`gemini-3.8-flash`) with verified billing. Returns `source: GEMINI_GROUNDED`.
- Database: Zero-external-dependency local database powered by Node v24's built-in `node:sqlite` for immediate local evaluation without requiring external DB containers, plus PostgreSQL connector for Cloud SQL.

## Roadmap & Milestones
- [x] **Milestone 0: Environment discovery & repository configuration documentation**
  - Inspected GCP permissions and discovered active Gemini API.
  - Created `AGENTS.md`, `PROJECT_MEMORY.md`, and `docs/environment-discovery.md`.
- [x] **Milestone 1: Core backend foundation & Data models**
  - Implemented 13 relational tables in `server/src/db/schema.sql`.
  - Implemented secure PBKDF2 password hashing and JWT authentication in `server/src/services/auth.ts`.
  - Implemented Profile-scoped RBAC and permission middleware (`requirePermission`) in `server/src/services/rbac.ts`.
  - Implemented cryptographic single-use invitation passcode generation & redemption in `server/src/services/invitation.ts`.
  - Implemented immutable audit trail in `server/src/services/audit.ts`.
- [x] **Milestone 2: Medication recurrence engine & Dose state machine**
  - Implemented medication scheduling with exact prescribed dose text preservation in `server/src/services/medication.ts`.
  - Implemented dose state machine (`UPCOMING`, `DUE`, `ACKNOWLEDGED_TAKEN`, `ACKNOWLEDGED_SKIPPED`, `UNABLE_TO_TAKE`, `OVERDUE_UNCONFIRMED`, `CANCELLED`) with 30-min grace period and audited correction in `server/src/services/dose.ts`.
  - Implemented transparent adherence calculation (excluding future doses) in `server/src/services/adherence.ts`.
- [x] **Milestone 3: Appointments, Care notes & Outbox notification pipeline**
  - Implemented doctor appointments with standard .ics calendar download in `server/src/services/appointment.ts`.
  - Implemented care notes journal & shift handover summary in `server/src/services/careNotes.ts`.
  - Implemented transactional outbox pattern in `server/src/services/outbox.ts`.
  - Implemented notification dispatcher, escalation policy, and email delivery inspector in `server/src/services/notification.ts` and `server/src/services/email.ts`.
- [x] **Milestone 4: Grounded AI Care Assistant & Safety guardrails**
  - Implemented Gemini 3.8 Flash grounded assistant with allowlisted backend tools in `server/src/services/ai.ts`.
  - Implemented pre-model safety interceptors for emergency symptoms and refusal to double dose.
  - Implemented deterministic non-AI fallback that extracts real structured care plan data if cloud credits or network access are unavailable.
- [x] **Milestone 5: Accessible Frontend Application**
  - Implemented WCAG 2.2 AA compliant senior view (18px+ font, large touch targets, time-aware greeting) in `client/src/components/ElderDashboard.tsx`.
  - Implemented family & caregiver portal with overdue check-in banners and adherence graphs in `client/src/components/FamilyDashboard.tsx`.
  - Implemented "Explain this alert" modal in `client/src/components/ExplainAlertModal.tsx`.
  - Implemented real-time email delivery inspector in `client/src/components/NotificationInspector.tsx`.
  - Implemented interactive "Ask Sahaaya" chat in `client/src/components/AiAssistantModal.tsx`.
  - Implemented Care Circle management, prescription management, and appointment scheduler.
  - Implemented persistent Judge Demo Simulation bar with controllable demo clock and 1-click persona switching.
- [x] **Milestone 6: Deterministic demo seed data & Automated test suite**
  - Implemented demo seed script with Anita Rao, Meera Rao, and Ravi Patil in `server/src/db/seed.ts`.
  - Created 20 automated unit, integration, and security tests: **100% pass rate (20/20 PASS)**.
- [x] **Milestone 7: Documentation & Containerization**
  - Created root `README.md` covering all 29 required sections.
  - Created `docs/architecture.md`, `docs/security-and-privacy.md`, `docs/ai-safety.md`, `docs/testing.md`, `docs/demo-script.md`.
  - Created multi-stage `Dockerfile` and `docker-compose.yml`.

## Quality Gates Status
- Application starts locally and serves API and static assets: **VERIFIED (Port 4003)**
- Health check `GET /health`: **STATUS 200 HEALTHY**
- Readiness check `GET /ready`: **STATUS 200 READY**
- Automated tests: **20/20 PASS**
- Zero secrets committed in source code: **VERIFIED**
