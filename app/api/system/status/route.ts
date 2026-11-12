import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const serverStartTime = Date.now();

export async function GET() {
  try {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    const heartbeats = await prisma.heartbeatLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    let dbStatus = "OK";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "FAIL";
    }

    return NextResponse.json({
      uptimeSeconds,
      dbStatus,
      heartbeats,
      serverStartTime: new Date(serverStartTime).toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const start = Date.now();
    let status = "OK";
    let details = "Manual health check passed.";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      status = "FAIL";
      details = `DB query failed: ${err.message}`;
    }

    const responseTimeMs = Date.now() - start;

    const heartbeat = await prisma.heartbeatLog.create({
      data: {
        status,
        responseTimeMs,
        details,
      },
    });

    return NextResponse.json({ success: true, heartbeat });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

