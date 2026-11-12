# WardPulse — Clinical Quarantine Ward Board & Management System

> Real-time single-source-of-truth floor plan ward board, pipeline-gated physician rounds, automated 3-day fever-free zero-paperwork discharges, and Wilson 95% Confidence Interval quality alerting for a 74-bed virus quarantine and treatment facility.

---

## 📁 Monorepo Structure

```
WardPulse-FactWise/
├── backend/                  # Node.js + Express + Prisma (Deploy to Render)
│   ├── prisma/
│   │   ├── schema.prisma     # PostgreSQL Prisma Schema
│   │   └── seed.ts           # 74 rooms, 120 historical records, waitlist, staff
│   ├── src/
│   │   ├── server.ts         # Express server, SSE broadcaster, background schedulers
│   │   └── lib/              # Pure domain rules, auth, audit, notifications
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # Next.js 14 App Router + Tailwind (Deploy to Vercel)
│   ├── app/                  # All 7 UI screens (Responsive Desktop & Mobile)
│   ├── components/           # Navbar with Dark Mode, Keypad, Drawers, Badges
│   ├── next.config.mjs       # Rewrites proxying /api/* calls to backend URL
│   ├── tailwind.config.ts
│   └── package.json
│
├── render.yaml               # Render Blueprint (points to backend/)
└── README.md
```

---

## 🚀 Deployment Guide

### 1. Deploy Backend on Render (Web Service)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
2. Connect your GitHub repository `https://github.com/Siddhantbht02/WardPulse-FactWise.git`.
3. Configure the service:
   - **Name**: `wardpulse-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build && npx prisma db push`
   - **Start Command**: `npm start`
4. Set Environment Variables in Render:
   - `DATABASE_URL`: `postgres://37ca9ca15fbd73726e67a185a0fe0ad5556c8c6076be9dd77f4b26b40de8eb6c:sk_vih4gOVH-8iPwsC-8rVf8@db.prisma.io:5432/postgres?sslmode=require`
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: `wardpulse-super-secret-key-2026`
   - `KEEP_ALIVE_URL`: `https://<your-render-backend-url>.onrender.com/api/health`
   - `KEEP_ALIVE_INTERVAL_MS`: `300000`
   - `KEEP_ALIVE_ENABLED`: `true`
5. Click **Create Web Service**. Once deployed, copy your Render URL (e.g., `https://wardpulse-backend.onrender.com`).

---

### 2. Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New > Project**.
2. Import the `WardPulse-FactWise` repository.
3. In project settings:
   - **Root Directory**: Click Edit and select `frontend`.
   - **Framework Preset**: `Next.js`
4. Add Environment Variables:
   - `BACKEND_URL`: `https://<your-render-backend-url>.onrender.com` (from step 1)
   - `NEXT_PUBLIC_API_URL`: `https://<your-render-backend-url>.onrender.com`
5. Click **Deploy**. Vercel will automatically build and launch your frontend with full Dark Mode, responsive layouts, and zero-config proxying of all `/api/*` endpoints to Render!

---

## 💻 Local Development

### Run Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
# Backend runs on http://localhost:5000
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000 (proxies /api to http://localhost:5000)
```

---

## 👥 Demo Staff Credentials (Visible on Landing Page)

No signups required. The landing page includes **1-Tap Quick Demo Login buttons** and a gloved-hand friendly numeric keypad:

| Role | Staff Name | Duty | PIN | Dashboard Route |
|------|------------|------|-----|-----------------|
| **ADMIN** | Dr. Sarah Chen | Chief Medical Administrator | `1111` | `/admin` |
| **DOCTOR** | Dr. Vikram Patel | Infectious Disease Specialist | `3333` | `/doctor` |
| **NURSE** | Nurse Anita Roy | Lead Quarantine Nurse | `2222` | `/nurse` |

---

## 🏥 Clinical Workflows & Core Features

1. **74-Bed Live Ward Board**: Single source of truth floor-plan grid with 3-dot streak tracking (`●●○`) and real-time SSE updates.
2. **Strict Pipeline Gating**: Doctors cannot log visits until today's temperature exists.
3. **Zero-Paperwork Discharges**: Automates discharge upon reaching 3 consecutive fever-free days with instant jsPDF summary download.
4. **Wilson 95% Confidence Interval Quality Control**: Evaluates facility mortality performance against the 15% benchmark without false alarms.
5. **Dark Mode & High Contrast**: Accessible in low-light night shifts and WCAG AA compliant.
