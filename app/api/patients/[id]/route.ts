import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFacilityLocalDate, determinePipeline, getStreakHistory } from "@/lib/rules";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
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
          include: { recordedBy: { select: { id: true, name: true, role: true } } },
          orderBy: { recordedAt: "desc" },
        },
        visits: {
          include: { doctor: { select: { id: true, name: true, role: true } } },
          orderBy: { visitedAt: "desc" },
        },
        claim: {
          include: { nurse: { select: { id: true, name: true } } },
        },
        tempRequests: {
          include: { doctor: { select: { id: true, name: true } } },
          orderBy: { requestedAt: "desc" },
        },
        dischargeEvents: {
          orderBy: { eligibleAt: "desc" },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const hasVisitToday = patient.visits.some((v) => v.localDate === todayStr);

    const pipeline = determinePipeline({
      patientStatus: patient.status,
      readings: patient.readings,
      hasVisitToday,
      threshold,
      requiredStreak,
      todayStr,
    });

    const streakHistory = getStreakHistory(patient.readings, threshold, todayStr, 7);

    // Build unified timeline
    const timeline: Array<{
      id: string;
      type: "ADMISSION" | "READING" | "VISIT" | "REQUEST" | "DISCHARGE_EVENT" | "DECEASED";
      timestamp: Date;
      title: string;
      description: string;
      actor: string;
      details?: any;
    }> = [];

    timeline.push({
      id: `adm-${patient.id}`,
      type: "ADMISSION",
      timestamp: patient.admittedAt,
      title: "Patient Admitted",
      description: `Admitted to Room ${patient.room?.roomNumber || "N/A"} with initial severity ${patient.severity}.`,
      actor: "Admin Staff",
    });

    patient.readings.forEach((r) => {
      timeline.push({
        id: `rd-${r.id}`,
        type: "READING",
        timestamp: r.recordedAt,
        title: `Temperature: ${r.valueC.toFixed(1)}°C ${r.valueC >= threshold ? "(Fever)" : "(Normal)"}`,
        description: r.isRemeasure ? `Re-measured reading. Reason: ${r.reason || "None specified"}` : "Routine daily measurement.",
        actor: r.recordedBy.name,
        details: { valueC: r.valueC, isRemeasure: r.isRemeasure },
      });
    });

    patient.visits.forEach((v) => {
      timeline.push({
        id: `vs-${v.id}`,
        type: "VISIT",
        timestamp: v.visitedAt,
        title: "Doctor Clinical Round",
        description: v.clinicalNote,
        actor: v.doctor.name,
        details: { plan: v.treatmentPlan, medication: v.medication },
      });
    });

    patient.tempRequests.forEach((tr) => {
      timeline.push({
        id: `tr-${tr.id}`,
        type: "REQUEST",
        timestamp: tr.requestedAt,
        title: "Temperature Priority Request",
        description: `Doctor requested temperature reading (Status: ${tr.status}).`,
        actor: tr.doctor.name,
      });
    });

    if (patient.deceasedAt) {
      timeline.push({
        id: `dec-${patient.id}`,
        type: "DECEASED",
        timestamp: patient.deceasedAt,
        title: "Patient Deceased",
        description: patient.deceasedCause || "Clinical mortality recorded.",
        actor: "Doctor",
      });
    }

    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      patient,
      pipeline,
      streakHistory,
      timeline,
      threshold,
      requiredStreak,
      todayStr,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can modify patient assignments" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { targetRoomId, symptoms, severity, emergencyContact, contactPhone } = body;

    const currentPatient = await prisma.patient.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!currentPatient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Room transfer logic
    if (targetRoomId && targetRoomId !== currentPatient.roomId) {
      const targetRoom = await prisma.room.findUnique({ where: { id: Number(targetRoomId) } });
      if (!targetRoom || targetRoom.status !== "FREE") {
        return NextResponse.json({ error: "Target room must exist and be FREE." }, { status: 400 });
      }

      await prisma.$transaction([
        // Free old room
        prisma.room.update({
          where: { id: currentPatient.roomId! },
          data: { status: "CLEANING", cleaningStartedAt: new Date() },
        }),
        // Occupy new room
        prisma.room.update({
          where: { id: Number(targetRoomId) },
          data: { status: "OCCUPIED" },
        }),
        // Update patient
        prisma.patient.update({
          where: { id },
          data: { roomId: Number(targetRoomId) },
        }),
      ]);

      await createAuditLog({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: "TRANSFER_ROOM",
        entityType: "Patient",
        entityId: id,
        payload: { fromRoom: currentPatient.room?.roomNumber, toRoom: targetRoom.roomNumber },
      });

      sseManager.broadcast("PATIENT_TRANSFERRED", {
        patientId: id,
        fromRoomId: currentPatient.roomId,
        toRoomId: targetRoomId,
      });

      return NextResponse.json({ success: true, message: "Patient transferred successfully." });
    }

    // Update details
    const updated = await prisma.patient.update({
      where: { id },
      data: {
        symptoms: symptoms !== undefined ? symptoms : undefined,
        severity: severity !== undefined ? severity : undefined,
        emergencyContact: emergencyContact !== undefined ? emergencyContact : undefined,
        contactPhone: contactPhone !== undefined ? contactPhone : undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "UPDATE_PATIENT_DETAILS",
      entityType: "Patient",
      entityId: id,
      payload: body,
    });

    return NextResponse.json({ patient: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

