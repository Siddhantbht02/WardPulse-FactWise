import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  recordLoginFailure,
  resetLoginAttempts,
  createSessionCookie,
} from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { userId, pin } = await req.json();

    if (!userId || !pin) {
      return NextResponse.json({ error: "User ID and PIN are required" }, { status: 400 });
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Please wait ${rateCheck.waitSeconds} seconds.`,
          locked: true,
          waitSeconds: rateCheck.waitSeconds,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.pin !== pin) {
      const failResult = recordLoginFailure(userId);
      await createAuditLog({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        payload: { reason: "Incorrect PIN" },
      });

      if (failResult.locked) {
        return NextResponse.json(
          {
            error: "5 consecutive failed attempts. Account locked for 60 seconds.",
            locked: true,
            waitSeconds: 60,
          },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: "Invalid PIN. Please try again." }, { status: 401 });
    }

    // Successful login
    resetLoginAttempts(userId);

    const sessionUser = {
      id: user.id,
      name: user.name,
      role: user.role as "ADMIN" | "NURSE" | "DOCTOR",
      avatar: user.avatar,
    };

    createSessionCookie(sessionUser);

    await createAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
    });

    return NextResponse.json({ user: sessionUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

