import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFacilityLocalDate } from "@/lib/rules";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Only doctors and admins can log clinical visits" }, { status: 403 });
    }

    const body = await req.json();
    const { patientId, clinicalNote, treatmentPlan, medication } = body;

    if (!patientId || !clinicalNote) {
      return NextResponse.json({ error: "patientId and clinicalNote are required" }, { status: 400 });
    }

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        room: true,
        readings: { where: { localDate: todayStr } },
        visits: { where: { localDate: todayStr } },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // STRICT PIPELINE GATING:
    // Doctor CANNOT log a visit if today's temperature does not exist!
    if (patient.readings.length === 0) {
      return NextResponse.json(
        {
          error: "Strict clinical gating: cannot log doctor visit before today's temperature is recorded. Please request temperature first.",
          gated: true,
        },
        { status: 422 }
      );
    }

    // Create doctor visit
    const visit = await prisma.doctorVisit.create({
      data: {
        patientId,
        doctorId: user.id,
        localDate: todayStr,
        clinicalNote,
        treatmentPlan: treatmentPlan || null,
        medication: medication || null,
      },
      include: {
        doctor: { select: { id: true, name: true, role: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "LOG_DOCTOR_VISIT",
      entityType: "DoctorVisit",
      entityId: visit.id,
      payload: {
        patientId,
        patientName: patient.name,
        roomNumber: patient.room?.roomNumber,
        clinicalNote,
      },
    });

    // Broadcast move to SEEN in real time
    sseManager.broadcast("VISIT_LOGGED", {
      visit,
      patientId,
      roomNumber: patient.room?.roomNumber,
    });

    return NextResponse.json({ visit, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

