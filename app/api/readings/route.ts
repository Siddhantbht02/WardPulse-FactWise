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
    if (!user || (user.role !== "NURSE" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Only nurses and admins can record temperatures" }, { status: 403 });
    }

    const body = await req.json();
    const { patientId, valueC, isRemeasure, reason, idempotencyKey } = body;

    if (!patientId || valueC === undefined) {
      return NextResponse.json({ error: "patientId and valueC are required" }, { status: 400 });
    }

    const tempVal = Number(valueC);
    if (isNaN(tempVal) || tempVal < 34.0 || tempVal > 42.0) {
      return NextResponse.json(
        { error: "Temperature must be between 34.0°C and 42.0°C" },
        { status: 400 }
      );
    }

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        room: true,
        readings: true,
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // 1. Duplicate check for today
    const existingToday = patient.readings.filter((r) => r.localDate === todayStr);
    if (existingToday.length > 0 && !isRemeasure) {
      const prior = existingToday[0];
      const priorUser = await prisma.user.findUnique({ where: { id: prior.recordedById } });
      const timeStr = new Date(prior.recordedAt).toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
      });

      return NextResponse.json(
        {
          error: `Already measured today at ${timeStr} by ${priorUser?.name || "Staff"} (${prior.valueC.toFixed(1)}°C). A re-measure requires a reason.`,
          isDuplicate: true,
          priorReading: {
            valueC: prior.valueC,
            recordedBy: priorUser?.name || "Staff",
            time: timeStr,
          },
        },
        { status: 409 }
      );
    }

    if (existingToday.length > 0 && isRemeasure && !reason) {
      return NextResponse.json(
        { error: "A clinical reason is mandatory for re-measuring a patient today." },
        { status: 400 }
      );
    }

    // 2. Insert reading and update pending requests atomically
    const reading = await prisma.$transaction(async (tx) => {
      const rec = await tx.temperatureReading.create({
        data: {
          patientId,
          valueC: tempVal,
          recordedById: user.id,
          isRemeasure: !!isRemeasure,
          reason: reason || null,
          localDate: todayStr,
          idempotencyKey: idempotencyKey || null,
        },
        include: {
          recordedBy: { select: { id: true, name: true, role: true } },
        },
      });

      // Fulfill any pending TempRequests for this patient
      await tx.tempRequest.updateMany({
        where: { patientId, status: "PENDING" },
        data: { status: "FULFILLED" },
      });

      return rec;
    });

    // 3. Re-evaluate patient streak and status
    const allReadings = [...patient.readings, reading];
    const { streak } = calculateStreak(allReadings, threshold, todayStr);

    let updatedPatientStatus = patient.status;
    if (streak >= requiredStreak && patient.status !== "DISCHARGE_ELIGIBLE" && patient.status !== "DISCHARGED") {
      updatedPatientStatus = "DISCHARGE_ELIGIBLE";
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: "DISCHARGE_ELIGIBLE" },
      });

      // Create admin notification
      await createNotification({
        role: "ADMIN",
        title: "Discharge Ready",
        message: `Room ${patient.room?.roomNumber || "N/A"} (${patient.name}) has reached ${streak} consecutive fever-free days and is ready for discharge.`,
        type: "SUCCESS",
        link: `/discharge?room=${patient.room?.roomNumber}`,
      });
    } else if (patient.status === "ADMITTED") {
      updatedPatientStatus = "UNDER_TREATMENT";
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: "UNDER_TREATMENT" },
      });
    }

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: isRemeasure ? "REMEASURE_TEMPERATURE" : "RECORD_TEMPERATURE",
      entityType: "TemperatureReading",
      entityId: reading.id,
      payload: {
        patientId,
        patientName: patient.name,
        roomNumber: patient.room?.roomNumber,
        valueC: tempVal,
        isRemeasure: !!isRemeasure,
        reason,
        streak,
      },
    });

    // Broadcast update across all screens in real time
    sseManager.broadcast("READING_RECORDED", {
      reading,
      patientId,
      streak,
      patientStatus: updatedPatientStatus,
      roomNumber: patient.room?.roomNumber,
    });

    return NextResponse.json({ reading, streak, patientStatus: updatedPatientStatus });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate reading or idempotency key already processed" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

