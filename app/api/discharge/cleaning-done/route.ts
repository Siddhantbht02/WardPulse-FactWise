import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await req.json();
    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const room = await prisma.room.update({
      where: { id: Number(roomId) },
      data: {
        status: "FREE",
        cleaningStartedAt: null,
      },
    });

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "ROOM_CLEANING_COMPLETED",
      entityType: "Room",
      entityId: String(roomId),
      payload: { roomNumber: room.roomNumber },
    });

    sseManager.broadcast("ROOM_STATUS_CHANGED", {
      roomId: room.id,
      roomNumber: room.roomNumber,
      status: "FREE",
    });

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

