import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

// Claim a bed (expires in 20 minutes)
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "NURSE") {
      return NextResponse.json({ error: "Only nurses can claim beds" }, { status: 403 });
    }

    const { patientId } = await req.json();
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes

    // Check existing active claim
    const existing = await prisma.nurseClaim.findUnique({
      where: { patientId },
      include: { nurse: { select: { name: true } } },
    });

    if (existing && new Date(existing.expiresAt) > now && existing.nurseId !== user.id) {
      return NextResponse.json(
        { error: `Bed is already claimed by Nurse ${existing.nurse.name}` },
        { status: 409 }
      );
    }

    const claim = await prisma.nurseClaim.upsert({
      where: { patientId },
      update: {
        nurseId: user.id,
        claimedAt: now,
        expiresAt,
      },
      create: {
        patientId,
        nurseId: user.id,
        claimedAt: now,
        expiresAt,
      },
      include: {
        nurse: { select: { id: true, name: true } },
      },
    });

    sseManager.broadcast("BED_CLAIMED", { claim, patientId });

    return NextResponse.json({ claim });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Release a claim
export async function DELETE(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId query parameter is required" }, { status: 400 });
    }

    await prisma.nurseClaim.deleteMany({
      where: { patientId },
    });

    sseManager.broadcast("BED_CLAIM_RELEASED", { patientId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

