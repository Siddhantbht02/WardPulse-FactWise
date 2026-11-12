import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getSessionUser();
    if (!user || (user.role !== "NURSE" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { valueC, fixReason } = body;

    const reading = await prisma.temperatureReading.findUnique({
      where: { id },
      include: { patient: { include: { room: true } } },
    });

    if (!reading) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }

    // 5-minute typo fix window check
    const elapsedMs = Date.now() - new Date(reading.recordedAt).getTime();
    if (elapsedMs > 5 * 60 * 1000 && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Typo fix window expired (allowed only within 5 minutes of entry)" },
        { status: 400 }
      );
    }

    const newVal = Number(valueC);
    if (isNaN(newVal) || newVal < 34.0 || newVal > 42.0) {
      return NextResponse.json({ error: "Valid temperature between 34.0 and 42.0°C required" }, { status: 400 });
    }

    const updated = await prisma.temperatureReading.update({
      where: { id },
      data: {
        valueC: newVal,
        reason: fixReason ? `Typo fixed: ${fixReason}` : reading.reason,
      },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "TYPO_FIX_TEMPERATURE",
      entityType: "TemperatureReading",
      entityId: id,
      payload: {
        oldValue: reading.valueC,
        newValue: newVal,
        fixReason,
        patientName: reading.patient.name,
      },
    });

    sseManager.broadcast("READING_UPDATED", {
      reading: updated,
      patientId: reading.patientId,
    });

    return NextResponse.json({ reading: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

