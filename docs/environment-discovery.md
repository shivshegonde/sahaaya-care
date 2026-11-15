# Environment Discovery Report

## Executive Summary
- **Target Project**: `ai-builder-sql-copilot`
- **Region**: `asia-south1`
- **Local Runtime**: Node.js `v24.21.0`, npm `11.19.0`, Python 3.14, Git `2.55.0.windows.5`
- **Google Cloud SDK**: Version `591.0.0`
- **Active Service Account**: `sql-copilot-sa@ai-builder-sql-copilot.iam.gserviceaccount.com` (from `donotpush/gcp-key.json`)

## Discovered GCP Permissions & Services
| Capability | State / Finding | Strategy |
|---|---|---|
| Gemini AI API | **Active & Verified** (50 models available including `gemini-2.5-flash`, `gemini-flash-latest`) | Utilized for Grounded AI Care Assistant, Daily Briefing, and Care Handover summaries. |
| Cloud Run / Service Usage APIs | Permission Denied (`serviceusage.services.list`, `run.services.list` restricted for SA) | Provide local Express server, Dockerfile, Cloud Build config, and documented Cloud Run deployment commands. |
| Cloud Storage | Permission Denied (`storage.buckets.list` restricted for SA) | Abstracted Storage adapter: Local private storage with authenticated streaming endpoint + GCS implementation. |
| Database | Cloud SQL credentials not pre-provisioned | Zero-setup embedded `node:sqlite` storage for instant local evaluation + PostgreSQL connector for Cloud SQL. |

## Secrets Management
- All secrets and keys are read from environment variables (`.env`).
- No private keys, passwords, or tokens are checked into source code.
