import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFacilityLocalDate, calculateStreak } from "@/lib/rules";
import { createNotification } from "@/lib/notifications";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const threshold = settings?.feverThreshold ?? 38.0;
    const requiredStreak = settings?.requiredFeverFreeDays ?? 3;
    const timezone = settings?.timezone ?? "Asia/Kolkata";

    // Simulating next day:
    // Shift all historical readings and visits back by 1 calendar day
    const allReadings = await prisma.temperatureReading.findMany();
    for (const r of allReadings) {
      const d = new Date(r.recordedAt);
      const newRecordedAt = new Date(d.getTime() - 86400000);
      const newLocalDate = getFacilityLocalDate(newRecordedAt, timezone);
      await prisma.temperatureReading.update({
        where: { id: r.id },
        data: {
          recordedAt: newRecordedAt,
          localDate: newLocalDate,
        },
      });
    }

    const allVisits = await prisma.doctorVisit.findMany();
    for (const v of allVisits) {
      const d = new Date(v.visitedAt);
      const newVisitedAt = new Date(d.getTime() - 86400000);
      const newLocalDate = getFacilityLocalDate(newVisitedAt, timezone);
      await prisma.doctorVisit.update({
        where: { id: v.id },
        data: {
          visitedAt: newVisitedAt,
          localDate: newLocalDate,
        },
      });
    }

    // Now today is clear of today's readings, putting patients into NEEDS_TEMP
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    // Re-evaluate patients: streak continues from yesterday's readings!
    const activePatients = await prisma.patient.findMany({
      where: { status: { in: ["ADMITTED", "UNDER_TREATMENT", "DISCHARGE_ELIGIBLE"] } },
      include: { readings: true, room: true },
    });

    let newlyEligibleCount = 0;
    for (const p of activePatients) {
      const { streak } = calculateStreak(p.readings, threshold, todayStr);
      if (streak >= requiredStreak && p.status !== "DISCHARGE_ELIGIBLE") {
        await prisma.patient.update({
          where: { id: p.id },
          data: { status: "DISCHARGE_ELIGIBLE" },
        });
        newlyEligibleCount++;
        await createNotification({
          role: "ADMIN",
          title: "Discharge Ready (Next Day Rollover)",
          message: `Room ${p.room?.roomNumber || "N/A"} (${p.name}) reached ${streak} fever-free days.`,
          type: "SUCCESS",
        });
      }
    }

    sseManager.broadcast("DAY_SIMULATED", { todayStr, newlyEligibleCount });

    return NextResponse.json({
      success: true,
      message: `Calendar day advanced! Today's queue reset to NEEDS_TEMP. ${newlyEligibleCount} patients advanced to Discharge Eligible.`,
      todayStr,
      newlyEligibleCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

