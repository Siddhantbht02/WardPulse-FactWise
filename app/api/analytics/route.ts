import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateWilsonCI, getFacilityLocalDate } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const window = searchParams.get("window") || "all"; // "7d", "30d", "all"
    const format = searchParams.get("format"); // "csv" or json

    const settings = await prisma.facilitySettings.findUnique({ where: { id: "default" } });
    const benchmark = settings?.benchmarkMortality ?? 0.15;
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const todayStr = getFacilityLocalDate(new Date(), timezone);

    // Filter date condition for rolling windows
    let dateFilter: any = {};
    const now = new Date();
    if (window === "7d") {
      dateFilter = { gte: new Date(now.getTime() - 7 * 86400000) };
    } else if (window === "30d") {
      dateFilter = { gte: new Date(now.getTime() - 30 * 86400000) };
    }

    // 1. Fetch counts
    const totalAdmitted = await prisma.patient.count({
      where: window !== "all" ? { admittedAt: dateFilter } : undefined,
    });

    const activePatients = await prisma.patient.count({
      where: {
        status: { in: ["ADMITTED", "UNDER_TREATMENT", "DISCHARGE_ELIGIBLE"] },
      },
    });

    const discharges = await prisma.patient.findMany({
      where: {
        status: "DISCHARGED",
        ...(window !== "all" ? { dischargedAt: dateFilter } : {}),
      },
      select: { id: true, admittedAt: true, dischargedAt: true },
    });

    const deaths = await prisma.patient.findMany({
      where: {
        status: "DECEASED",
        ...(window !== "all" ? { deceasedAt: dateFilter } : {}),
      },
      select: { id: true, admittedAt: true, deceasedAt: true },
    });

    const totalRecoveries = discharges.length;
    const totalDeaths = deaths.length;
    const closedCases = totalRecoveries + totalDeaths;

    // 2. Wilson 95% Confidence Interval
    const wilsonResult = calculateWilsonCI(totalDeaths, totalRecoveries, benchmark);

    // 3. Average Days to Cure
    let totalCureDays = 0;
    discharges.forEach((p) => {
      if (p.dischargedAt) {
        const diffMs = new Date(p.dischargedAt).getTime() - new Date(p.admittedAt).getTime();
        totalCureDays += diffMs / (1000 * 60 * 60 * 24);
      }
    });
    const avgDaysToCure = totalRecoveries > 0 ? Number((totalCureDays / totalRecoveries).toFixed(1)) : 0;

    // 4. Compliance Metrics for Today
    const todayReadings = await prisma.temperatureReading.findMany({
      where: { localDate: todayStr },
      select: { recordedAt: true, isRemeasure: true },
    });

    const beforeNoonCount = todayReadings.filter((r) => {
      const d = new Date(r.recordedAt);
      const h = d.getHours();
      return h < 12;
    }).length;

    const percentMeasuredBeforeNoon =
      todayReadings.length > 0 ? Math.round((beforeNoonCount / todayReadings.length) * 100) : 0;

    const totalReMeasures = await prisma.temperatureReading.count({
      where: { isRemeasure: true },
    });

    const todayVisits = await prisma.doctorVisit.count({
      where: { localDate: todayStr },
    });

    // 5. Daily Trend series (last 14 days)
    const trendMap: Record<string, { date: string; admitted: number; discharged: number; deceased: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = getFacilityLocalDate(d, timezone);
      trendMap[ds] = { date: ds.slice(5), admitted: 0, discharged: 0, deceased: 0 };
    }

    const allPatients = await prisma.patient.findMany({
      select: { admittedAt: true, dischargedAt: true, deceasedAt: true },
    });

    allPatients.forEach((p) => {
      const admStr = getFacilityLocalDate(new Date(p.admittedAt), timezone);
      if (trendMap[admStr]) trendMap[admStr].admitted += 1;

      if (p.dischargedAt) {
        const disStr = getFacilityLocalDate(new Date(p.dischargedAt), timezone);
        if (trendMap[disStr]) trendMap[disStr].discharged += 1;
      }

      if (p.deceasedAt) {
        const decStr = getFacilityLocalDate(new Date(p.deceasedAt), timezone);
        if (trendMap[decStr]) trendMap[decStr].deceased += 1;
      }
    });

    const trendSeries = Object.values(trendMap);

    // 6. CSV Export handler
    if (format === "csv") {
      const csvHeader = "Metric,Value,Benchmark,Notes\n";
      const rows = [
        `Total Admissions,${totalAdmitted},-,Window: ${window}`,
        `Active Patients,${activePatients},-,Current ward occupancy`,
        `Recoveries (Discharged),${totalRecoveries},-,Achieved 3 fever-free days`,
        `Deaths,${totalDeaths},-,Clinical mortality`,
        `Mortality Rate,${(wilsonResult.observedRate * 100).toFixed(1)}%,${(benchmark * 100).toFixed(1)}%,Wilson 95% CI: [${(wilsonResult.lowerBound * 100).toFixed(1)}% - ${(wilsonResult.upperBound * 100).toFixed(1)}%]`,
        `Survival Rate,${((1 - wilsonResult.observedRate) * 100).toFixed(1)}%,${((1 - benchmark) * 100).toFixed(1)}%,Benchmark is 85%`,
        `Quality Status,${wilsonResult.status},-,${wilsonResult.statusExplanation}`,
        `Average Days to Cure,${avgDaysToCure} days,-,Mean duration of stay`,
        `Temp Measured Before Noon,${percentMeasuredBeforeNoon}%,100%,Cutoff compliance`,
        `Re-measure Count,${totalReMeasures},-,Tagged duplicate checks`,
      ];

      return new Response(csvHeader + rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=wardpulse-analytics-${window}-${todayStr}.csv`,
        },
      });
    }

    return NextResponse.json({
      window,
      totalAdmitted,
      activePatients,
      totalRecoveries,
      totalDeaths,
      closedCases,
      mortalityRate: wilsonResult.observedRate,
      survivalRate: 1 - wilsonResult.observedRate,
      wilsonCI: wilsonResult,
      avgDaysToCure,
      compliance: {
        percentMeasuredBeforeNoon,
        todayVisits,
        totalReMeasures,
        visitsBeforeTempTarget: 0, // Enforced by pipeline gating
      },
      trendSeries,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

