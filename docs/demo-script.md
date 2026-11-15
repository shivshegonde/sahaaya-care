# Sahaaya Care — Hackathon Judge Demo Script (5–7 Minutes)

This walkthrough follows the exact steps outlined in Part 4 of the hackathon requirements, demonstrating the core problem, accessible senior view, collaborative care circle, adherence state machine, escalation alerts, and grounded AI assistant.

---

### Step 1: Context & Problem Overview (30 seconds)
- **Objective:** Frame the challenge.
- **Narrative:** Older adults often manage multiple daily medications and doctor appointments. When an alert rings, families want reassurance that the medicine was taken, but existing alarm apps either treat the senior like an invalid or spam family members with panic alerts.
- **Core Message:** *"Sahaaya Care does more than remind. It closes the loop between a care routine, a person's acknowledgement, trusted family support, and an explainable record — while keeping the elderly person in control."*

---

### Step 2: Open Anita Rao's Senior Dashboard (45 seconds)
1. Navigate to `http://localhost:4003/`.
2. Click **"👵 Anita Rao (Elder Owner)"** on the Judge Demo Simulation bar.
3. **Showcase:**
   - Time-aware morning greeting: *"Good morning, Anita!"*.
   - Large, high-contrast, uncluttered layout with 18px+ font and touch targets >= 52px.
   - Prominent **Next Due Dose** card showing *Amlodipine 5mg* with instructions *"With water after breakfast"*.
   - **Today's Medication Timeline** showing dose statuses: Taken, Due Now, and Overdue.
   - **"Who can see my care information?"** transparency box.

---

### Step 3: Acknowledge a Dose & Test Dose Correction (60 seconds)
1. On the Amlodipine card, click **"Mark Taken"** or **"Update Status"**.
2. Note the confirmation: Status updates to `ACKNOWLEDGED_TAKEN`, logging Anita's user ID and current timestamp.
3. Demonstrate undo/correction: Click **"Edit / Undo"**, select **"Correct"**, enter a reason (*"Tapped taken by accident; taking with water now"*), and click **"Save Audited Correction"**.
4. Show that history is preserved and logged in the immutable audit trail rather than silently overwritten.

---

### Step 4: Switch to Family View & Demonstrate Explain-This-Alert (60 seconds)
1. In the bottom simulation bar, click **"👩 Meera Rao (Family Admin)"** (or click the *Family & Caregiver Portal* pill in the navbar).
2. **Showcase:**
   - Immediate Attention banner for the overdue *Metformin 500mg* dose.
   - Notice the exact wording: *"No acknowledgement was recorded"* — never accusing the mother of having forgotten her medicine.
3. Click **"Explain Alert"**:
   - Displays the scheduled time, the 30-minute grace period, the escalation rule that fired, and the delivery status of the email sent to Meera.
4. Open the **Deliveries Inspector** (bell icon in navbar) to inspect the actual transactional email subject and body text!

---

### Step 5: Test Time Travel & Grace Period Escalation (45 seconds)
1. In the bottom simulation bar, click **"+30m (Grace Period)"**.
2. Click **"⚡ Check Due Reminders"**.
3. Point out that the background dispatcher evaluates dose transitions, detects eligible overdue events, and dispatches escalation emails to authorized contacts without sending duplicate notifications (idempotent delivery).

---

### Step 6: Ask the Grounded AI Care Assistant (60 seconds)
1. Click **"Ask Sahaaya"** in the top navbar.
2. Click the quick prompt: **"What medicines are due today?"**
   - The assistant answers in calm, respectful language using structured data from `get_today_care_plan`.
3. Test safety: Ask **"I missed my morning tablet, should I take two tablets now?"**
   - **Result:** The assistant firmly refuses to suggest double dosing or altering schedules, directing Anita to consult her doctor or pharmacist.
4. Test emergency safety: Ask **"I have sudden severe chest pain"**
   - **Result:** The assistant immediately returns emergency contact guidance (112/108/hospital) without attempting diagnostic reasoning.

---

### Step 7: Care Circle Access & Revocation (45 seconds)
1. Click **"Care Circle & Access"**.
2. Show active members: Anita Rao (Owner), Meera Rao (Family Admin), Ravi Patil (Caretaker).
3. Demonstrate creating an invitation: Enter an email, choose `CARE_COORDINATOR`, and click **"Create Passcode"**.
4. Show the cryptographically generated single-use passcode (e.g. `SHY-ABCD`) and explain that only the SHA-256 hash is stored.
5. Highlight the **"Revoke Access"** button, which terminates access immediately at the database layer.

---

### Step 8: Accessibility Mode & Closing (30 seconds)
1. Click the **"High Contrast"** button in the top navbar.
2. Show the WCAG 2.2 AA compliant high-contrast theme (dark background, bright yellow/white contrast borders).
3. Summarize:
   - 100% automated test pass rate (20/20 unit, integration, and security tests).
   - Zero external database installation needed (runs out of the box with Node v24 built-in SQLite engine).
   - Ready for Google Cloud Run deployment.
