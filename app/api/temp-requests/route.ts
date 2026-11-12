import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "DOCTOR") {
      return NextResponse.json({ error: "Only doctors can request temperature readings" }, { status: 403 });
    }

    const { patientId, priority = "URGENT" } = await req.json();
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { room: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const tempRequest = await prisma.tempRequest.create({
      data: {
        patientId,
        doctorId: user.id,
        priority,
        status: "PENDING",
      },
      include: {
        doctor: { select: { id: true, name: true } },
      },
    });

    // Notify nurses with priority flag
    await createNotification({
      role: "NURSE",
      title: "Priority Temperature Requested",
      message: `${user.name} requested an urgent temperature for Room ${patient.room?.roomNumber || "N/A"} (${patient.name}).`,
      type: "ALERT",
      link: `/nurse?room=${patient.room?.roomNumber}`,
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "REQUEST_TEMPERATURE",
      entityType: "TempRequest",
      entityId: tempRequest.id,
      payload: { room: patient.room?.roomNumber, patientName: patient.name },
    });

    sseManager.broadcast("TEMP_REQUESTED", { tempRequest, patientId, roomNumber: patient.room?.roomNumber });

    return NextResponse.json({ tempRequest, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const requests = await prisma.tempRequest.findMany({
      where: { status: "PENDING" },
      include: {
        patient: { include: { room: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

