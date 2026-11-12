import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let settings = await prisma.facilitySettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.facilitySettings.create({
        data: {
          id: "default",
          feverThreshold: 38.0,
          requiredFeverFreeDays: 3,
          benchmarkMortality: 0.15,
          timezone: "Asia/Kolkata",
          tempCutoffHour: 12,
          doctorCutoffHour: 17,
          demoMode: true,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const updated = await prisma.facilitySettings.update({
      where: { id: "default" },
      data: {
        feverThreshold: body.feverThreshold !== undefined ? Number(body.feverThreshold) : undefined,
        requiredFeverFreeDays: body.requiredFeverFreeDays !== undefined ? Number(body.requiredFeverFreeDays) : undefined,
        benchmarkMortality: body.benchmarkMortality !== undefined ? Number(body.benchmarkMortality) : undefined,
        timezone: body.timezone || undefined,
        tempCutoffHour: body.tempCutoffHour !== undefined ? Number(body.tempCutoffHour) : undefined,
        doctorCutoffHour: body.doctorCutoffHour !== undefined ? Number(body.doctorCutoffHour) : undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "UPDATE_SETTINGS",
      entityType: "FacilitySettings",
      payload: body,
    });

    sseManager.broadcast("SETTINGS_UPDATED", updated);
    return NextResponse.json({ settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

