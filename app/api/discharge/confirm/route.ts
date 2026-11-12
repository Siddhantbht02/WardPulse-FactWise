import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Only doctors or admins can confirm discharge eligibility" }, { status: 403 });
    }

    const { patientId, doctorNote } = await req.json();
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        dischargeConfirmedBy: user.name,
        dischargeNotes: doctorNote || "Clinical criteria confirmed by physician.",
      },
      include: { room: true },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "CONFIRM_DISCHARGE_ELIGIBILITY",
      entityType: "Patient",
      entityId: patientId,
      payload: { doctor: user.name, roomNumber: patient.room?.roomNumber },
    });

    sseManager.broadcast("DISCHARGE_CONFIRMED", { patientId, confirmedBy: user.name });

    return NextResponse.json({ success: true, patient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

