import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFacilityLocalDate, determinePipeline } from "@/lib/rules";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const tempCutoffHour = settings?.tempCutoffHour ?? 12;
    const doctorCutoffHour = settings?.doctorCutoffHour ?? 17;

    const todayStr = getFacilityLocalDate(new Date(), timezone);

    // Current facility local time
    const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    const currentHour = nowLocal.getHours();
    const currentMinute = nowLocal.getMinutes();

    // Fetch all 74 rooms with patients, readings, visits, claims, tempRequests
    const rooms = await prisma.room.findMany({
      orderBy: { id: "asc" },
      include: {
        patient: {
          include: {
            readings: {
              orderBy: { recordedAt: "desc" },
            },
            visits: {
              where: { localDate: todayStr },
            },
            claim: true,
            tempRequests: {
              where: { status: "PENDING" },
            },
          },
        },
      },
    });

    // Transform and evaluate each room/patient
    const roomItems = rooms.map((room) => {
      const patient = room.patient;
      if (!patient || patient.status === "DISCHARGED" || patient.status === "DECEASED") {
        return {
          room: {
            id: room.id,
            roomNumber: room.roomNumber,
            section: room.section,
            status: room.status, // FREE or CLEANING
          },
          patient: null,
          pipeline: null,
        };
      }

      const hasVisitToday = patient.visits.length > 0;
      const pipeline = determinePipeline({
        patientStatus: patient.status,
        readings: patient.readings,
        hasVisitToday,
        threshold,
        requiredStreak,
        todayStr,
        currentHour,
        currentMinute,
        tempCutoffHour,
        doctorCutoffHour,
      });

      const todayReadings = patient.readings.filter((r) => r.localDate === todayStr);
      const latestReading = patient.readings[0] || null;

      // Active claim check
      const isClaimed = patient.claim && new Date(patient.claim.expiresAt) > new Date();
      const hasPendingTempRequest = patient.tempRequests.length > 0;

      return {
        room: {
          id: room.id,
          roomNumber: room.roomNumber,
          section: room.section,
          status: room.status,
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
          admittedAt: patient.admittedAt,
          roomId: room.id,
          roomNumber: room.roomNumber,
          latestTemp: latestReading?.valueC ?? null,
          latestTempTime: latestReading?.recordedAt ?? null,
          todayTemp: todayReadings[0]?.valueC ?? null,
          todayVisit: hasVisitToday,
          claim: isClaimed ? patient.claim : null,
          hasPendingTempRequest,
        },
        pipeline,
      };
    });

    return NextResponse.json({
      rooms: roomItems,
      todayStr,
      settings: {
        feverThreshold: threshold,
        requiredFeverFreeDays: requiredStreak,
        timezone,
        tempCutoffHour,
        doctorCutoffHour,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can register and admit patients" }, { status: 403 });
    }

    const body = await req.json();
    const { name, age, sex, emergencyContact, contactPhone, symptoms, severity, roomId } = body;

    if (!name || !age || !sex || !emergencyContact || !roomId) {
      return NextResponse.json({ error: "All required patient fields must be provided" }, { status: 400 });
    }

    // 1. Capacity check: Max 74 beds
    const occupiedCount = await prisma.room.count({
      where: { status: "OCCUPIED" },
    });

    if (occupiedCount >= 74) {
      return NextResponse.json(
        {
          error: "Facility is at maximum 74-bed capacity. No beds available. Please add patient to waitlist.",
          atMaxCapacity: true,
        },
        { status: 400 }
      );
    }

    // 2. Room availability check
    const room = await prisma.room.findUnique({
      where: { id: Number(roomId) },
    });

    if (!room) {
      return NextResponse.json({ error: "Selected room does not exist" }, { status: 404 });
    }

    if (room.status !== "FREE") {
      return NextResponse.json(
        { error: `Room ${room.roomNumber} is currently ${room.status}. Please choose a FREE room.` },
        { status: 400 }
      );
    }

    // 3. Potential duplicate warning check
    const existing = await prisma.patient.findFirst({
      where: {
        name: { equals: name },
        age: Number(age),
        status: { in: ["ADMITTED", "UNDER_TREATMENT", "DISCHARGE_ELIGIBLE"] },
      },
    });

    if (existing && !body.ignoreDuplicateWarning) {
      return NextResponse.json(
        {
          warning: `A patient with the same name (${name}) and age (${age}) is currently admitted in Room ${existing.roomId}.`,
          isDuplicateWarning: true,
        },
        { status: 409 }
      );
    }

    // 4. Create patient and update room atomically
    const newPatient = await prisma.$transaction(async (tx) => {
      const p = await tx.patient.create({
        data: {
          name,
          age: Number(age),
          sex,
          emergencyContact,
          contactPhone: contactPhone || emergencyContact,
          symptoms,
          severity: severity || "MODERATE",
          status: "ADMITTED",
          roomId: Number(roomId),
        },
      });

      await tx.room.update({
        where: { id: Number(roomId) },
        data: { status: "OCCUPIED" },
      });

      return p;
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "ADMIT_PATIENT",
      entityType: "Patient",
      entityId: newPatient.id,
      payload: { name: newPatient.name, roomId, roomNumber: room.roomNumber },
    });

    sseManager.broadcast("PATIENT_ADMITTED", { patient: newPatient, roomId });

    return NextResponse.json({ patient: newPatient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

