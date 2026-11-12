# WardPulse — Clinical Quarantine Ward Board & Management System

> Real-time single-source-of-truth floor plan ward board, pipeline-gated physician rounds, automated 3-day fever-free zero-paperwork discharges, and Wilson 95% Confidence Interval quality alerting for a 74-bed virus quarantine and treatment facility.

---

## ⚡ Quick Start (Under 5 Commands)

```bash
# 1. Clone repository
git clone <repo-url> && cd FactWise

# 2. Install dependencies
npm install

# 3. Setup database & seed with 74 rooms and 120+ clinical cases
npx prisma db push && npm run seed

# 4. Run tests
npm test

# 5. Start long-running server with live SSE & 5-min self-ping scheduler
npm run dev
```

Application will be live at `http://localhost:3000`.

---

## 👥 Demo Staff Credentials (Visible on Landing Page)

No signups required. The landing page includes **1-Tap Quick Demo Login buttons** and a gloved-hand friendly numeric keypad:

| Role | Staff Name | Specialty / Duty | PIN | Dashboard Route |
|------|------------|------------------|-----|-----------------|
| **ADMIN** | Dr. Sarah Chen | Chief Medical Administrator | `1111` | `/admin` |
| **ADMIN** | Marcus Vance | Facility Operations Lead | `1122` | `/admin` |
| **DOCTOR** | Dr. Priya Sharma | Infectious Disease Specialist | `2222` | `/doctor` |
| **DOCTOR** | Dr. Robert Kim | Critical Care Lead | `2233` | `/doctor` |
| **DOCTOR** | Dr. Ananya Iyer | Pulmonology Specialist | `2244` | `/doctor` |
| **NURSE** | Anita Patel | Lead Quarantine Nurse | `3333` | `/nurse` |
| **NURSE** | John Mwangi | Staff Nurse (Wing A/B) | `3344` | `/nurse` |
| **NURSE** | Maria Gomez | Staff Nurse (Wing C) | `3355` | `/nurse` |
| **NURSE** | David Zhao | Staff Nurse (Wing D) | `3366` | `/nurse` |
| **NURSE** | Sunita Rao | Staff Nurse (Wing E) | `3377` | `/nurse` |
| **NURSE** | Carlos Ruiz | Staff Nurse (Float) | `3388` | `/nurse` |

---

## 🏥 Clinical Workflow & Core Innovations

### 1. The 74-Room Live Ward Board
- Floor-plan grid of all 74 rooms with live state transitions:
  `NEEDS_TEMP` ➔ `READY_FOR_DOCTOR` ➔ `SEEN` ➔ `DISCHARGE_ELIGIBLE`.
- Visual 3-dot streak indicators (`●●○`) displaying exact progress toward cure.
- Real-time SSE updates broadcast across all connected tablets in under 1 second without browser refresh.

### 2. Strict Pipeline Gating
- Doctors **cannot** log a visit until today's temperature exists.
- The UI displays "Waiting for temperature" and offers "Request temperature now", prioritizing the patient in the nurse worklist.
- Eliminates duplicate visits and ensures physicians make informed assessments.

### 3. Zero-Paperwork 3-Day Fever-Free Discharges
- Sole cure criterion: **3 full consecutive calendar days with all temperatures $< 38.0^\circ\text{C}$**.
- As soon as the 3rd fever-free day is recorded, the patient is flagged `DISCHARGE_ELIGIBLE`.
- Admin processes discharge with 1 click:
  - Generates an official, printable **PDF Discharge Certificate**.
  - Releases the room to `CLEANING`, and then `FREE`.
  - Automatically prompts to admit the top candidate from the waitlist into the newly freed room.

### 4. Wilson 95% Confidence Interval Quality Control
- Continuous statistical monitoring against the $15\%$ mortality benchmark ($85\%$ survival rate).
- Avoids small-sample false alarms:
  - **GREEN**: Observed mortality $\le 15\%$.
  - **AMBER**: Observed mortality $> 15\%$, but the Wilson lower bound is $\le 15\%$ (statistical noise warning).
  - **RED**: Wilson lower bound $> 15\%$ (statistically significant excess mortality requiring immediate clinical escalation).

### 5. Always-On Resilience & 5-Minute Self-Ping
- Custom Node server `server.ts` runs a self-ping scheduler calling `/api/health` every 5 minutes.
- Results logged to `HeartbeatLog` (retained for 7 days). Two consecutive failures trigger an administrative emergency alert.
- Background daemons clean up expired 20-min bed claims, monitor 4-hour discharge escalations, and handle day rollovers.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Styling**: Tailwind CSS, Lucide React, High Contrast Mode (WCAG AA)
- **Charts**: Recharts (temperature trends, control charts, daily outcome cohorts)
- **Database & ORM**: Prisma ORM with SQLite (local dev) / PostgreSQL (production)
- **Server**: Custom Node.js `server.ts` with Server-Sent Events (SSE) and autonomous scheduler
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Testing**: Vitest (pure domain rules) + Playwright (mobile 390x844 & desktop 1440x900 E2E)

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Prisma DB connection string | `file:./dev.db` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `PORT` | HTTP Server port | `3000` |
| `SESSION_SECRET` | Secret key for auth tokens | 32+ character random string |
| `KEEP_ALIVE_URL` | Public or internal URL to self-ping | `http://localhost:3000/api/health` |
| `KEEP_ALIVE_INTERVAL_MS` | Interval between self-pings (ms) | `300000` (5 minutes) |
| `KEEP_ALIVE_ENABLED` | Enable background heartbeat | `true` |
| `DEMO_MODE` | Enable demo tools (Simulate Day) | `true` |

---

## 🧪 Testing

```bash
# Run unit tests for domain rules & Wilson CI
npx vitest run

# Run end-to-end tests across mobile & desktop viewports
npx playwright test
```
