import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFacilityLocalDate, calculateStreak } from "@/lib/rules";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can finalize discharge and release rooms" }, { status: 403 });
    }

    const { patientId, dischargeNotes } = await req.json();
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        room: true,
        readings: { orderBy: { recordedAt: "desc" } },
        dischargeEvents: { orderBy: { eligibleAt: "desc" } },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const { streak, feverFreeDates } = calculateStreak(patient.readings, threshold, todayStr);
    if (streak < requiredStreak && patient.status !== "DISCHARGE_ELIGIBLE") {
      return NextResponse.json(
        { error: `Patient has only ${streak} fever-free days. Exactly ${requiredStreak} days required.` },
        { status: 400 }
      );
    }

    const roomId = patient.roomId;
    const roomNumber = patient.room?.roomNumber;
    const now = new Date();

    // Prepare proof data
    const proofReadings = feverFreeDates.map((dateStr) => {
      const dayReadings = patient.readings.filter((r) => r.localDate === dateStr);
      const maxTemp = Math.max(...dayReadings.map((r) => r.valueC));
      return { date: dateStr, maxTemp };
    });

    // Execute atomic discharge transaction
    const [updatedPatient, dischargeEvent] = await prisma.$transaction([
      // 1. Update patient to DISCHARGED
      prisma.patient.update({
        where: { id: patientId },
        data: {
          status: "DISCHARGED",
          dischargedAt: now,
          dischargeCompletedBy: user.name,
          dischargeNotes: dischargeNotes || `Discharged after ${streak} consecutive fever-free days.`,
          roomId: null, // Unlink room from active patient
        },
      }),

      // 2. Set room to CLEANING
      prisma.room.update({
        where: { id: roomId! },
        data: {
          status: "CLEANING",
          cleaningStartedAt: now,
        },
      }),

      // 3. Create DischargeEvent record
      prisma.dischargeEvent.create({
        data: {
          patientId,
          eligibleAt: patient.dischargeEvents[0]?.eligibleAt || now,
          confirmedBy: patient.dischargeConfirmedBy || "Clinical Criteria Met",
          completedBy: user.name,
          completedAt: now,
          summaryJson: JSON.stringify({
            patientName: patient.name,
            age: patient.age,
            sex: patient.sex,
            admittedAt: patient.admittedAt,
            dischargedAt: now,
            feverFreeDays: streak,
            proof: proofReadings,
          }),
        },
      }),
    ]);

    // Check if waitlist has entries
    const nextWaitlisted = await prisma.waitlistEntry.findFirst({
      where: { status: "WAITING" },
      orderBy: { priority: "asc" },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "PROCESS_DISCHARGE",
      entityType: "Patient",
      entityId: patientId,
      payload: {
        patientName: patient.name,
        roomNumber,
        feverFreeDays: streak,
        proofReadings,
      },
    });

    await createNotification({
      role: "ALL",
      title: "Patient Discharged",
      message: `${patient.name} has been cured and discharged from Room ${roomNumber}. Room is now cleaning.`,
      type: "SUCCESS",
    });

    sseManager.broadcast("DISCHARGE_PROCESSED", {
      patientId,
      roomId,
      roomNumber,
      dischargedAt: now,
      nextWaitlisted,
    });

    return NextResponse.json({
      success: true,
      patient: updatedPatient,
      dischargeEvent,
      freedRoomId: roomId,
      freedRoomNumber: roomNumber,
      nextWaitlisted,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
