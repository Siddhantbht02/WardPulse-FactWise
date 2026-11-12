import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: { status: "WAITING" },
      orderBy: [{ priority: "asc" }, { addedAt: "asc" }],
    });

    return NextResponse.json({ waitlist: entries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage waitlist entries" }, { status: 403 });
    }

    const body = await req.json();
    const { patientName, age, sex, emergencyContact, contactPhone, symptoms, severity, priority } = body;

    if (!patientName || !age || !sex || !emergencyContact) {
      return NextResponse.json({ error: "Missing required patient fields" }, { status: 400 });
    }

    // Default priority to bottom of list if not provided
    const maxPriority = await prisma.waitlistEntry.aggregate({
      where: { status: "WAITING" },
      _max: { priority: true },
    });
    const nextPriority = priority !== undefined ? Number(priority) : (maxPriority._max.priority || 0) + 1;

    const entry = await prisma.waitlistEntry.create({
      data: {
        patientName,
        age: Number(age),
        sex,
        emergencyContact,
        contactPhone: contactPhone || emergencyContact,
        symptoms,
        severity: severity || "MODERATE",
        priority: nextPriority,
        status: "WAITING",
      },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "ADD_TO_WAITLIST",
      entityType: "WaitlistEntry",
      entityId: entry.id,
      payload: { patientName, priority: nextPriority },
    });

    sseManager.broadcast("WAITLIST_UPDATED", { action: "ADD", entry });

    return NextResponse.json({ entry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Admit waitlisted patient into a FREE room or reorder
export async function PATCH(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can admit waitlist patients" }, { status: 403 });
    }

    const body = await req.json();
    const { action, entryId, targetRoomId, newPriority } = body;

    if (action === "ADMIT") {
      if (!entryId || !targetRoomId) {
        return NextResponse.json({ error: "entryId and targetRoomId are required for admission" }, { status: 400 });
      }

      const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
      if (!entry || entry.status !== "WAITING") {
        return NextResponse.json({ error: "Waitlist entry is not waiting" }, { status: 400 });
      }

      const room = await prisma.room.findUnique({ where: { id: Number(targetRoomId) } });
      if (!room || room.status !== "FREE") {
        return NextResponse.json({ error: `Room ${room?.roomNumber || targetRoomId} is not FREE.` }, { status: 400 });
      }

      // Atomic admission transaction
      const newPatient = await prisma.$transaction(async (tx) => {
        // Mark waitlist as ADMITTED
        await tx.waitlistEntry.update({
          where: { id: entryId },
          data: { status: "ADMITTED" },
        });

        // Set room OCCUPIED
        await tx.room.update({
          where: { id: Number(targetRoomId) },
          data: { status: "OCCUPIED" },
        });

        // Create Patient
        return tx.patient.create({
          data: {
            name: entry.patientName,
            age: entry.age,
            sex: entry.sex,
            emergencyContact: entry.emergencyContact,
            contactPhone: entry.contactPhone,
            symptoms: entry.symptoms,
            severity: entry.severity,
            status: "ADMITTED",
            roomId: Number(targetRoomId),
          },
        });
      });

      await createAuditLog({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: "ADMIT_FROM_WAITLIST",
        entityType: "Patient",
        entityId: newPatient.id,
        payload: { patientName: newPatient.name, roomNumber: room.roomNumber },
      });

      sseManager.broadcast("WAITLIST_ADMITTED", { patient: newPatient, roomId: targetRoomId });

      return NextResponse.json({ success: true, patient: newPatient });
    }

    if (action === "REORDER") {
      if (!entryId || newPriority === undefined) {
        return NextResponse.json({ error: "entryId and newPriority are required" }, { status: 400 });
      }

      const updated = await prisma.waitlistEntry.update({
        where: { id: entryId },
        data: { priority: Number(newPriority) },
      });

      sseManager.broadcast("WAITLIST_UPDATED", { action: "REORDER", entry: updated });

      return NextResponse.json({ success: true, entry: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

