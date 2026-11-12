import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const startTime = Date.now();

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = "down";

  try {
    // Fast database ping
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch (err) {
    dbStatus = "down";
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    uptimeSeconds,
    timestamp,
    db: dbStatus,
    version: "1.0.0",
  });
}

