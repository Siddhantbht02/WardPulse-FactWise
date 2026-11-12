import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { PrismaClient } from "@prisma/client";
import { sseManager } from "./lib/sse";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// Keep-alive configuration
const KEEP_ALIVE_INTERVAL_MS = parseInt(process.env.KEEP_ALIVE_INTERVAL_MS || "300000", 10); // 5 minutes
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || `http://localhost:${port}/api/health`;
const KEEP_ALIVE_ENABLED = process.env.KEEP_ALIVE_ENABLED !== "false";

let consecutiveHeartbeatFailures = 0;
let isHeartbeatRunning = false;

// Background self-ping scheduler
async function runHeartbeat() {
  if (!KEEP_ALIVE_ENABLED || isHeartbeatRunning) return;
  isHeartbeatRunning = true;

  const start = Date.now();
  let status = "OK";
  let details = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(KEEP_ALIVE_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      status = "FAIL";
      details = `HTTP status ${res.status}`;
      consecutiveHeartbeatFailures++;
    } else {
      status = "OK";
      details = "Self-ping succeeded";
      consecutiveHeartbeatFailures = 0;
    }
  } catch (err: any) {
    status = "FAIL";
    details = `Fetch error: ${err.message}`;
    consecutiveHeartbeatFailures++;
  } finally {
    const responseTimeMs = Date.now() - start;

    try {
      await prisma.heartbeatLog.create({
        data: {
          status,
          responseTimeMs,
          timestamp: new Date(),
          details,
        },
      });

      // Prune logs older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      await prisma.heartbeatLog.deleteMany({
        where: { timestamp: { lt: sevenDaysAgo } },
      });

      // Alert if two consecutive failures
      if (consecutiveHeartbeatFailures >= 2) {
        console.warn("⚠️ System Alert: Two consecutive heartbeat ping failures!");
        await prisma.notification.create({
          data: {
            role: "ADMIN",
            title: "Uptime Alert: Health Check Failure",
            message: `The server self-ping has failed ${consecutiveHeartbeatFailures} consecutive times. Details: ${details}`,
            type: "ALERT",
          },
        });
        sseManager.broadcast("HEARTBEAT_ALERT", { consecutiveFailures: consecutiveHeartbeatFailures });
      }
    } catch (dbErr) {
      console.error("Error writing heartbeat log to DB:", dbErr);
    }

    isHeartbeatRunning = false;
  }
}

// Background clinical daemon (runs every 60 seconds)
async function runBackgroundDaemon() {
  try {
    const now = new Date();

    // 1. Clean up expired nurse claims (20-min window)
    const expiredClaims = await prisma.nurseClaim.findMany({
      where: { expiresAt: { lt: now } },
    });
    if (expiredClaims.length > 0) {
      await prisma.nurseClaim.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      expiredClaims.forEach((c) => {
        sseManager.broadcast("BED_CLAIM_RELEASED", { patientId: c.patientId, expired: true });
      });
    }

    // 2. 4-hour discharge escalation check
    const fourHoursAgo = new Date(now.getTime() - 4 * 3600000);
    const pendingDischarges = await prisma.dischargeEvent.findMany({
      where: {
        completedAt: null,
        eligibleAt: { lt: fourHoursAgo },
      },
      include: { patient: { include: { room: true } } },
    });

    for (const de of pendingDischarges) {
      if (de.patient && de.patient.status === "DISCHARGE_ELIGIBLE") {
        await prisma.notification.create({
          data: {
            role: "ADMIN",
            title: "Discharge Delayed (> 4 Hours)",
            message: `Room ${de.patient.room?.roomNumber || "N/A"} (${de.patient.name}) has been eligible for discharge for over 4 hours. Bed freeing pending!`,
            type: "WARNING",
            link: `/discharge?room=${de.patient.room?.roomNumber}`,
          },
        });
      }
    }
  } catch (err) {
    console.error("Background daemon error:", err);
  }
}

// Global crash resilience
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
});

async function main() {
  await app.prepare();

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> WardPulse server ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`> Keep-alive self-ping interval: ${KEEP_ALIVE_INTERVAL_MS}ms`);

    // Initial heartbeat after 5 seconds
    setTimeout(runHeartbeat, 5000);

    // Self-ping interval with +/-10s jitter
    setInterval(() => {
      const jitter = (Math.random() - 0.5) * 20000;
      setTimeout(runHeartbeat, Math.max(1000, jitter));
    }, KEEP_ALIVE_INTERVAL_MS);

    // Background clinical daemon interval (every 60s)
    setInterval(runBackgroundDaemon, 60000);
  });

  const shutdown = async () => {
    console.log("\nReceived termination signal. Shutting down gracefully...");
    server.close(async () => {
      await prisma.$disconnect();
      console.log("WardPulse server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

