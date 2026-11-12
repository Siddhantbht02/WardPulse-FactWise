import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import { sseManager } from "./lib/sse";
import {
  getSessionUser,
  createSessionCookie,
  clearSessionCookie,
  checkRateLimit,
  recordLoginFailure,
  resetLoginAttempts,
} from "./lib/auth";
import {
  calculateStreak,
  getStreakHistory,
  determinePipeline,
  calculateWilsonCI,
  getFacilityLocalDate,
  evaluateDay,
} from "./lib/rules";
import { createAuditLog } from "./lib/audit";
import { createNotification } from "./lib/notifications";

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || "5000", 10);
const startTime = Date.now();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// -------------------------------------------------------------
// SSE Stream: Real-Time Event Broadcaster
// -------------------------------------------------------------
app.get("/api/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`data: ${JSON.stringify({ type: "CONNECTED", message: "WardPulse SSE stream connected" })}\n\n`);

  const onBroadcast = (payload: any) => {
    res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
  };

  sseManager.on("broadcast", onBroadcast);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseManager.off("broadcast", onBroadcast);
  });
});

// -------------------------------------------------------------
// System Health & Heartbeat Status
// -------------------------------------------------------------
app.get(["/api/health", "/api/system/health"], async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - start;
    res.json({
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      db: "ok",
      dbStatus: "OK",
      responseTimeMs,
      version: "1.0.0",
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message, db: "fail", dbStatus: "FAIL" });
  }
});

// Full System Status & Heartbeat History
app.get("/api/system/status", async (req: Request, res: Response) => {
  const start = Date.now();
  let dbStatus = "OK";
  let responseTimeMs = 0;
  try {
    await prisma.$queryRaw`SELECT 1`;
    responseTimeMs = Date.now() - start;
  } catch {
    dbStatus = "FAIL";
    responseTimeMs = Date.now() - start;
  }

  try {
    const heartbeats = await prisma.heartbeatLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    res.json({
      status: dbStatus === "OK" ? "ok" : "error",
      dbStatus,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      responseTimeMs,
      timestamp: new Date().toISOString(),
      heartbeats,
      scheduler: {
        active: true,
        intervalMinutes: 5,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.message,
      dbStatus: "FAIL",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      heartbeats: [],
    });
  }
});

// Trigger Manual / On-Demand Health Check
app.post(["/api/system/status", "/api/system/health", "/api/health"], async (req: Request, res: Response) => {
  const start = Date.now();
  let status = "OK";
  let details = "Manual health check triggered via dashboard";
  let responseTimeMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    responseTimeMs = Date.now() - start;
  } catch (err: any) {
    status = "FAIL";
    details = err.message || "Database connection error";
    responseTimeMs = Date.now() - start;
  }

  try {
    const log = await prisma.heartbeatLog.create({
      data: {
        status,
        responseTimeMs,
        details,
      },
    });

    res.json({
      success: status === "OK",
      status: status.toLowerCase(),
      heartbeat: log,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      heartbeat: {
        status,
        responseTimeMs,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// -------------------------------------------------------------
// Authentication Routes
// -------------------------------------------------------------
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin) return res.status(400).json({ error: "User ID and PIN are required" });

    const limit = checkRateLimit(userId);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Too many failed attempts. Locked for ${limit.waitSeconds} seconds.`,
        locked: true,
        waitSeconds: limit.waitSeconds,
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Staff member not found" });

    if (user.pin !== pin) {
      const failStatus = recordLoginFailure(userId);
      if (failStatus.locked) {
        return res.status(429).json({
          error: "Account locked due to 5 consecutive failed attempts. Wait 60 seconds.",
          locked: true,
          waitSeconds: 60,
        });
      }
      return res.status(401).json({ error: "Incorrect PIN" });
    }

    resetLoginAttempts(userId);

    const sessionUser = {
      id: user.id,
      name: user.name,
      role: user.role as "ADMIN" | "NURSE" | "DOCTOR",
      avatar: user.avatar,
    };

    createSessionCookie(res, sessionUser);

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "LOGIN",
      entityType: "AUTH",
      entityId: user.id,
    });

    res.json({ success: true, user: sessionUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (user) {
    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "LOGOUT",
      entityType: "AUTH",
      entityId: user.id,
    });
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ user: null });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    clearSessionCookie(res);
    return res.status(401).json({ user: null });
  }

  res.json({
    user: {
      id: dbUser.id,
      name: dbUser.name,
      role: dbUser.role,
      avatar: dbUser.avatar,
    },
  });
});

app.get("/api/auth/staff", async (req: Request, res: Response) => {
  const staff = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      avatar: true,
      pin: true,
      isDemo: true,
    },
  });
  res.json({ staff });
});

// -------------------------------------------------------------
// Patients & 74-Room Ward Operations
// -------------------------------------------------------------
app.get("/api/patients", async (req: Request, res: Response) => {
  try {
    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const tempCutoffHour = settings?.tempCutoffHour ?? 12;
    const doctorCutoffHour = settings?.doctorCutoffHour ?? 17;

    const todayStr = getFacilityLocalDate(new Date(), timezone);
    const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    const currentHour = nowLocal.getHours();

    const rooms = await prisma.room.findMany({
      orderBy: { id: "asc" },
      include: {
        patient: {
          include: {
            readings: { orderBy: { recordedAt: "desc" } },
            visits: { where: { localDate: todayStr } },
            claim: true,
            tempRequests: { where: { status: "PENDING" } },
          },
        },
      },
    });

    const roomItems = rooms.map((room) => {
      const patient = room.patient;
      if (!patient || patient.status === "DISCHARGED" || patient.status === "DECEASED") {
        return {
          room: {
            id: room.id,
            roomNumber: room.roomNumber,
            section: room.section,
            status: room.status,
            cleaningStartedAt: room.cleaningStartedAt,
          },
          patient: null,
          pipeline: null,
        };
      }

      const { streak } = calculateStreak(patient.readings, threshold, todayStr);
      const isEligible = streak >= requiredStreak;
      const todayReadings = patient.readings.filter((r) => r.localDate === todayStr);
      const hasTodayReading = todayReadings.length > 0;
      const latestReadingToday = todayReadings[0];
      const hasTodayVisit = patient.visits.length > 0;

      const pipelineEvaluation = determinePipeline({
        patientStatus: patient.status,
        readings: patient.readings,
        hasVisitToday: hasTodayVisit,
        threshold,
        requiredStreak,
        todayStr,
        currentHour,
        tempCutoffHour,
        doctorCutoffHour,
      });

      return {
        room: {
          id: room.id,
          roomNumber: room.roomNumber,
          section: room.section,
          status: room.status,
          cleaningStartedAt: room.cleaningStartedAt,
        },
        patient: {
          id: patient.id,
          name: patient.name,
          age: patient.age,
          sex: patient.sex,
          emergencyContact: patient.emergencyContact,
          contactPhone: patient.contactPhone,
          symptoms: patient.symptoms,
          severity: patient.severity,
          status: patient.status,
          admittedAt: patient.admittedAt.toISOString(),
          roomId: room.id,
          roomNumber: room.roomNumber,
          latestTemp: patient.readings[0]?.valueC ?? null,
          latestTempTime: patient.readings[0]?.recordedAt?.toISOString() ?? null,
          todayTemp: latestReadingToday?.valueC ?? null,
          todayVisit: hasTodayVisit,
          claim: patient.claim
            ? {
                id: patient.claim.id,
                nurseId: patient.claim.nurseId,
                claimedAt: patient.claim.claimedAt.toISOString(),
                expiresAt: patient.claim.expiresAt.toISOString(),
              }
            : null,
          hasPendingTempRequest: patient.tempRequests.length > 0,
        },
        pipeline: pipelineEvaluation,
      };
    });

    res.json({ rooms: roomItems, todayStr, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/patients", async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req);
    const { name, age, sex, emergencyContact, contactPhone, symptoms, severity, roomId } = req.body;

    if (!name || !age || !sex || !emergencyContact || !contactPhone || !roomId) {
      return res.status(400).json({ error: "Missing required patient registration fields" });
    }

    // Verify 74-capacity hard lock
    const occupiedCount = await prisma.room.count({ where: { status: "OCCUPIED" } });
    if (occupiedCount >= 74) {
      return res.status(400).json({
        error: "Facility is at maximum 74-bed capacity. Patient must be placed on the waitlist.",
        isFull: true,
      });
    }

    const room = await prisma.room.findUnique({ where: { id: parseInt(roomId, 10) } });
    if (!room) return res.status(404).json({ error: "Selected room does not exist" });
    if (room.status !== "FREE") return res.status(400).json({ error: `Room ${room.roomNumber} is currently ${room.status}` });

    const newPatient = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          name,
          age: parseInt(age, 10),
          sex,
          emergencyContact,
          contactPhone,
          symptoms: symptoms || null,
          severity: severity || "MODERATE",
          roomId: room.id,
          status: "ADMITTED",
        },
      });

      await tx.room.update({
        where: { id: room.id },
        data: { status: "OCCUPIED", cleaningStartedAt: null },
      });

      return patient;
    });

    await createAuditLog({
      userId: user?.id,
      userName: user?.name || "System Admin",
      role: user?.role || "ADMIN",
      action: "ADMIT_PATIENT",
      entityType: "PATIENT",
      entityId: newPatient.id,
      payload: { roomId: room.id, roomNumber: room.roomNumber, name },
    });

    sseManager.broadcast("PATIENT_ADMITTED", { patient: newPatient, roomNumber: room.roomNumber });
    res.json({ success: true, patient: newPatient });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/patients/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        room: true,
        readings: {
          orderBy: { recordedAt: "desc" },
          include: { recordedBy: { select: { id: true, name: true, role: true } } },
        },
        visits: {
          orderBy: { visitedAt: "desc" },
          include: { doctor: { select: { id: true, name: true, role: true } } },
        },
        claim: { include: { nurse: { select: { id: true, name: true } } } },
        tempRequests: {
          orderBy: { requestedAt: "desc" },
          include: { doctor: { select: { id: true, name: true } } },
        },
        dischargeEvents: { orderBy: { eligibleAt: "desc" } },
      },
    });

    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const { streak } = calculateStreak(patient.readings, threshold, todayStr);
    const streakHistory = getStreakHistory(patient.readings, threshold, todayStr, 7);
    const todayReadings = patient.readings.filter((r) => r.localDate === todayStr);
    const hasTodayReading = todayReadings.length > 0;
    const hasTodayVisit = patient.visits.some((v) => v.localDate === todayStr);

    const pipelineEvaluation = determinePipeline({
      patientStatus: patient.status,
      readings: patient.readings,
      hasVisitToday: hasTodayVisit,
      threshold,
      requiredStreak,
      todayStr,
    });

    const timeline: any[] = [];
    if (patient.admittedAt) {
      timeline.push({
        id: `adm-${patient.id}`,
        type: "ADMISSION",
        timestamp: patient.admittedAt,
        title: "Patient Admitted to Quarantine Facility",
        description: `Admitted to Room ${patient.room?.roomNumber || "Unassigned"}. Initial triage severity: ${patient.severity}. Symptoms: ${patient.symptoms || "None specified"}.`,
        actor: "Admissions Admin",
      });
    }

    patient.readings.forEach((r) => {
      const isFever = r.valueC >= threshold;
      timeline.push({
        id: `read-${r.id}`,
        type: "TEMPERATURE",
        timestamp: r.recordedAt,
        title: `Temperature Logged: ${r.valueC.toFixed(1)}°C`,
        description: `${isFever ? "⚠️ Elevated temperature (fever detected)" : "✓ Normal temperature"}${r.isRemeasure ? " (Re-measurement)" : ""}. ${r.reason || "Routine daily measurement"}`,
        actor: r.recordedBy?.name || "Staff Nurse",
      });
    });

    patient.visits.forEach((v) => {
      timeline.push({
        id: `vis-${v.id}`,
        type: "DOCTOR_VISIT",
        timestamp: v.visitedAt,
        title: "Clinical Doctor Visit & Assessment",
        description: `${v.clinicalNote}${v.treatmentPlan ? ` | Treatment: ${v.treatmentPlan}` : ""}${v.medication ? ` | Medication: ${v.medication}` : ""}`,
        actor: v.doctor?.name || "Attending Physician",
      });
    });

    patient.tempRequests.forEach((tr) => {
      timeline.push({
        id: `req-${tr.id}`,
        type: "TEMP_REQUEST",
        timestamp: tr.requestedAt,
        title: `Priority Temperature Requested (${tr.priority})`,
        description: tr.status === "RESOLVED" ? "Resolved by nursing staff reading." : "Pending nurse temperature measurement.",
        actor: tr.doctor?.name || "Attending Physician",
      });
    });

    patient.dischargeEvents.forEach((de) => {
      timeline.push({
        id: `dis-${de.id}`,
        type: "DISCHARGE",
        timestamp: de.eligibleAt,
        title: "Discharge Eligibility Met (3-Day Fever-Free Streak)",
        description: `Patient maintained 3 consecutive calendar days without a fever. Ready for clinical discharge.`,
        actor: "Automated Clinical Rule Engine",
      });
    });

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      patient,
      pipeline: {
        ...pipelineEvaluation,
        streakHistory,
      },
      streakHistory,
      timeline,
      threshold,
      requiredStreak,
      todayStr,
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Temperature Readings & Duplicate Protection
// -------------------------------------------------------------
app.post("/api/readings", async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req);
    const { patientId, valueC, isRemeasure, reason, idempotencyKey } = req.body;

    if (!patientId || valueC === undefined) {
      return res.status(400).json({ error: "Patient ID and temperature reading value are required" });
    }

    const tempNum = parseFloat(valueC);
    if (isNaN(tempNum) || tempNum < 34.0 || tempNum > 42.0) {
      return res.status(400).json({ error: "Temperature must be between 34.0°C and 42.0°C" });
    }

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    // Duplicate check
    const existingReading = await prisma.temperatureReading.findFirst({
      where: { patientId, localDate: todayStr },
      include: { recordedBy: true },
    });

    if (existingReading && !isRemeasure) {
      return res.status(409).json({
        error: `Already measured today at ${new Date(existingReading.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} by ${existingReading.recordedBy.name} (${existingReading.valueC}°C).`,
        existingReading,
        requiresRemeasureReason: true,
      });
    }

    const reading = await prisma.$transaction(async (tx) => {
      const r = await tx.temperatureReading.create({
        data: {
          patientId,
          valueC: tempNum,
          recordedById: user?.id || "u-nurse-1",
          isRemeasure: Boolean(isRemeasure),
          reason: reason || null,
          localDate: todayStr,
          idempotencyKey: idempotencyKey || null,
        },
      });

      // Release any pending nurse claim and temp request
      await tx.nurseClaim.deleteMany({ where: { patientId } });
      await tx.tempRequest.updateMany({
        where: { patientId, status: "PENDING" },
        data: { status: "FULFILLED" },
      });

      return r;
    });

    // Check if new reading achieves 3-day fever-free streak
    const allReadings = await prisma.temperatureReading.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    });
    const { streak } = calculateStreak(allReadings, threshold, todayStr);

    if (streak >= requiredStreak) {
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: "DISCHARGE_ELIGIBLE" },
      });

      await prisma.dischargeEvent.upsert({
        where: { id: `event-${patientId}` },
        update: { eligibleAt: new Date() },
        create: {
          id: `event-${patientId}`,
          patientId,
          eligibleAt: new Date(),
        },
      });

      await createNotification({
        role: "ADMIN",
        title: "Patient Ready for Discharge",
        message: `Patient has completed ${streak} consecutive fever-free days!`,
        type: "ALERT",
      });
    }

    await createAuditLog({
      userId: user?.id,
      userName: user?.name || "Staff Nurse",
      role: user?.role || "NURSE",
      action: isRemeasure ? "REMEASURE_TEMPERATURE" : "RECORD_TEMPERATURE",
      entityType: "TEMPERATURE_READING",
      entityId: reading.id,
      payload: { patientId, valueC: tempNum, streak, isRemeasure, reason },
    });

    sseManager.broadcast("READING_RECORDED", { reading, streak });
    res.json({ success: true, reading, streak });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Doctor Rounds & Pipeline Gating
// -------------------------------------------------------------
app.post("/api/visits", async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req);
    const { patientId, clinicalNote, treatmentPlan, medication } = req.body;

    if (!patientId || !clinicalNote) {
      return res.status(400).json({ error: "Patient ID and clinical assessment note are required" });
    }

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    // STRICT PIPELINE GATING: Today's temperature MUST exist!
    const todayReading = await prisma.temperatureReading.findFirst({
      where: { patientId, localDate: todayStr },
    });

    if (!todayReading) {
      return res.status(412).json({
        error: "Strict Pipeline Gating: Doctor visit cannot be logged before today's temperature is recorded.",
        pipelineBlocked: true,
      });
    }

    const visit = await prisma.doctorVisit.create({
      data: {
        patientId,
        doctorId: user?.id || "u-doc-1",
        localDate: todayStr,
        clinicalNote,
        treatmentPlan: treatmentPlan || null,
        medication: medication || null,
      },
    });

    await createAuditLog({
      userId: user?.id,
      userName: user?.name || "Physician",
      role: user?.role || "DOCTOR",
      action: "LOG_DOCTOR_VISIT",
      entityType: "DOCTOR_VISIT",
      entityId: visit.id,
      payload: { patientId, clinicalNote },
    });

    sseManager.broadcast("VISIT_LOGGED", { visit });
    res.json({ success: true, visit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Priority Nurse Ping
app.post("/api/temp-requests", async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req);
    const { patientId, priority = "URGENT" } = req.body;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { room: true },
    });
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const request = await prisma.tempRequest.create({
      data: {
        patientId,
        doctorId: user?.id || "u-doc-1",
        priority,
      },
    });

    await createNotification({
      role: "NURSE",
      title: "Priority Temperature Requested",
      message: `Doctor requested immediate temperature reading for Room ${patient.room?.roomNumber || ""}.`,
      type: "WARNING",
    });

    sseManager.broadcast("TEMP_REQUESTED", {
      requestId: request.id,
      patientId,
      roomNumber: patient.room?.roomNumber,
    });

    res.json({ success: true, request });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 20-Minute Bed Claim
app.post("/api/claims", async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req);
    const { patientId } = req.body;

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
    const claim = await prisma.nurseClaim.upsert({
      where: { patientId },
      update: {
        nurseId: user?.id || "u-nurse-1",
        claimedAt: new Date(),
        expiresAt,
      },
      create: {
        patientId,
        nurseId: user?.id || "u-nurse-1",
        expiresAt,
      },
    });

    sseManager.broadcast("BED_CLAIMED", { claim });
    res.json({ success: true, claim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/claims", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;
    await prisma.nurseClaim.deleteMany({ where: { patientId } });
    sseManager.broadcast("BED_CLAIM_RELEASED", { patientId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Discharges & Room Turnover
// -------------------------------------------------------------
app.post("/api/discharge/process", async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req);
    const { patientId, dischargeNotes } = req.body;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { room: true, readings: true },
    });
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const todayStr = getFacilityLocalDate(new Date(), timezone);
    const { streak } = calculateStreak(patient.readings, threshold, todayStr);

    if (streak < requiredStreak) {
      return res.status(400).json({
        error: `Cannot discharge: patient has only ${streak} of ${requiredStreak} consecutive fever-free days.`,
      });
    }

    const roomId = patient.roomId;

    await prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: patientId },
        data: {
          status: "DISCHARGED",
          dischargedAt: new Date(),
          dischargeCompletedBy: user?.name || "Chief Admin",
          dischargeNotes: dischargeNotes || null,
          roomId: null,
        },
      });

      if (roomId) {
        await tx.room.update({
          where: { id: roomId },
          data: { status: "CLEANING", cleaningStartedAt: new Date() },
        });
      }
    });

    // Check if waitlist has candidates
    const nextWaitlist = await prisma.waitlistEntry.findFirst({
      where: { status: "WAITING" },
      orderBy: { priority: "asc" },
    });

    await createAuditLog({
      userId: user?.id,
      userName: user?.name || "Chief Admin",
      role: user?.role || "ADMIN",
      action: "PROCESS_DISCHARGE",
      entityType: "DISCHARGE",
      entityId: patientId,
      payload: { roomNumber: patient.room?.roomNumber, nextWaitlistCandidate: nextWaitlist?.patientName },
    });

    sseManager.broadcast("DISCHARGE_PROCESSED", {
      patientId,
      roomNumber: patient.room?.roomNumber,
      roomId,
      nextWaitlist,
    });

    res.json({
      success: true,
      message: "Patient discharged successfully. Room transitioned to CLEANING.",
      nextCandidate: nextWaitlist,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/discharge/cleaning-done", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.body;
    await prisma.room.update({
      where: { id: parseInt(roomId, 10) },
      data: { status: "FREE", cleaningStartedAt: null },
    });
    sseManager.broadcast("ROOM_FREE", { roomId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Waitlist Management
// -------------------------------------------------------------
app.get("/api/waitlist", async (req: Request, res: Response) => {
  const waitlist = await prisma.waitlistEntry.findMany({
    where: { status: "WAITING" },
    orderBy: { priority: "asc" },
  });
  res.json({ waitlist });
});

app.post("/api/waitlist", async (req: Request, res: Response) => {
  try {
    const { patientName, age, sex, emergencyContact, contactPhone, symptoms, severity, priority } = req.body;
    const entry = await prisma.waitlistEntry.create({
      data: {
        patientName,
        age: parseInt(age, 10),
        sex,
        emergencyContact,
        contactPhone,
        symptoms: symptoms || null,
        severity: severity || "MODERATE",
        priority: parseInt(priority || "1", 10),
      },
    });
    res.json({ success: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Wilson 95% Confidence Interval Quality Analytics
// -------------------------------------------------------------
app.get("/api/analytics", async (req: Request, res: Response) => {
  try {
    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const benchmark = settings?.benchmarkMortality ?? 0.15;

    const deceasedCount = await prisma.patient.count({ where: { status: "DECEASED" } });
    const dischargedCount = await prisma.patient.count({ where: { status: "DISCHARGED" } });

    const wilsonCI = calculateWilsonCI(deceasedCount, dischargedCount, benchmark);

    res.json({
      wilsonCI,
      counts: {
        deceased: deceasedCount,
        discharged: dischargedCount,
        totalClosed: deceasedCount + dischargedCount,
      },
      benchmark: benchmark * 100,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Facility Settings & Notifications
// -------------------------------------------------------------
app.get("/api/settings", async (req: Request, res: Response) => {
  const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
  res.json({ settings });
});

app.patch("/api/settings", async (req: Request, res: Response) => {
  try {
    const settings = await prisma.facilitySettings.update({
      where: { id: "default" },
      data: req.body,
    });
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/notifications", async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json({ notifications });
});

app.patch("/api/notifications", async (req: Request, res: Response) => {
  await prisma.notification.updateMany({ data: { isRead: true } });
  res.json({ success: true });
});

// -------------------------------------------------------------
// Autonomous Background Schedulers
// -------------------------------------------------------------
// 1. 5-Minute Health Heartbeat
setInterval(async () => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.heartbeatLog.create({
      data: {
        status: "OK",
        responseTimeMs: Date.now() - start,
        details: "Automated 5-minute database ping",
      },
    });
  } catch (err: any) {
    await prisma.heartbeatLog.create({
      data: {
        status: "FAIL",
        responseTimeMs: Date.now() - start,
        details: err.message,
      },
    });
  }
}, 5 * 60 * 1000);

// 2. 20-Minute Claim Cleaner
setInterval(async () => {
  try {
    const deleted = await prisma.nurseClaim.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (deleted.count > 0) {
      sseManager.broadcast("BED_CLAIMS_EXPIRED", { count: deleted.count });
    }
  } catch {}
}, 60 * 1000);

// -------------------------------------------------------------
// Start Server
// -------------------------------------------------------------
app.listen(port, "0.0.0.0", () => {
  console.log(`> WardPulse Express Backend listening on port ${port}`);
  console.log(`> Health endpoint: http://localhost:${port}/api/health`);
  console.log(`> Environment: ${process.env.NODE_ENV || "development"}`);
});
