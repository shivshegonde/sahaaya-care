# AGENTS.md — Sahaaya Care Architecture & Operating Principles

## Mission
Build **Sahaaya Care**, a consent-first, AI-assisted care coordination platform for older adults, family members, and caregivers for the **Catalyst PromptSwar — Elderly Care & Medication Management Platform** hackathon.

## Core Directives
1. **The Elderly Person Stays in Control**: All access granted to family/caretakers is consent-based, role-governed, and revocable at any time.
2. **Safe Clinical Boundaries**: No diagnosing, no prescribing, no auto-changing dosages. The system never asserts a medicine was not taken — only that "no acknowledgement was recorded."
3. **Defense in Depth**: Authorization and profile isolation enforced at the backend database/service layer, never trusting frontend or AI model output.
4. **Reliable Workflows**: Outbox event publishing, idempotent delivery, configurable escalation policies, transparent delivery status (`QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `RETRYING`).
5. **Deterministic AI Fallback**: If Gemini/Vertex AI is unavailable, core features (care plan summaries, alerts, adherence analytics) continue operating deterministically.
6. **Accessibility First (WCAG 2.2 AA)**: Minimum 18px base font for elderly dashboard, >= 44x44px touch targets, high-contrast mode, plain language, time-aware greetings.

## System Topology
- **Server**: Node.js v24 (ESM + TypeScript), Express, native `node:sqlite` for local zero-dependency runs + PostgreSQL adapter for Cloud SQL, transactional outbox engine, Gemini 3.8 Flash SDK integration.
- **Client**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, accessible responsive components.
- **Testing**: Node test runner / Vitest for unit, integration, and security isolation tests.
- **GCP Target**: Project `ai-builder-sql-copilot`, Cloud Run containerization, Cloud Storage signed URLs, Vertex AI / Gemini API.
