import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "DOCTOR") {
      return NextResponse.json({ error: "Only licensed doctors can certify clinical mortality" }, { status: 403 });
    }

    const { id } = params;
    const { cause, typedConfirmation } = await req.json();

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (typedConfirmation?.trim().toUpperCase() !== "CONFIRM") {
      return NextResponse.json(
        { error: "Must provide typed 'CONFIRM' to certify mortality" },
        { status: 400 }
      );
    }

    const roomId = patient.roomId;
    const roomNumber = patient.room?.roomNumber;
    const now = new Date();

    const [updatedPatient] = await prisma.$transaction([
      prisma.patient.update({
        where: { id },
        data: {
          status: "DECEASED",
          deceasedAt: now,
          deceasedCause: cause || "Viral complications / Multi-organ failure",
          roomId: null,
        },
      }),
      ...(roomId
        ? [
            prisma.room.update({
              where: { id: roomId },
              data: {
                status: "CLEANING",
                cleaningStartedAt: now,
              },
            }),
          ]
        : []),
    ]);

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "MARK_PATIENT_DECEASED",
      entityType: "Patient",
      entityId: id,
      payload: {
        patientName: patient.name,
        roomNumber,
        cause: cause || "Viral complications",
      },
    });

    await createNotification({
      role: "ALL",
      title: "Clinical Mortality Recorded",
      message: `Patient ${patient.name} (Room ${roomNumber}) certified deceased by ${user.name}.`,
      type: "ALERT",
    });

    sseManager.broadcast("PATIENT_DECEASED", {
      patientId: id,
      roomId,
      roomNumber,
    });

    return NextResponse.json({ success: true, patient: updatedPatient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

