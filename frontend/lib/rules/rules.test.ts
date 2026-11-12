import { describe, it, expect } from "vitest";
import {
  calculateStreak,
  determinePipeline,
  calculateWilsonCI,
  evaluateDay,
  getStreakHistory,
  getFacilityLocalDate,
} from "./index";

describe("WardPulse Domain Rules Engine", () => {
  const todayStr = "2026-11-12";
  const yesterdayStr = "2026-11-11";
  const twoDaysAgoStr = "2026-11-10";
  const threeDaysAgoStr = "2026-11-09";
  const fourDaysAgoStr = "2026-11-08";

  describe("Single Day Evaluation", () => {
    it("identifies a day with no readings as UNKNOWN_DAY", () => {
      const result = evaluateDay([], 38.0);
      expect(result.status).toBe("UNKNOWN_DAY");
      expect(result.maxTemp).toBeNull();
    });

    it("evaluates day as FEVER_FREE_DAY when all readings are below threshold", () => {
      const readings = [
        { valueC: 37.1, localDate: todayStr },
        { valueC: 37.4, localDate: todayStr },
      ];
      const result = evaluateDay(readings, 38.0);
      expect(result.status).toBe("FEVER_FREE_DAY");
      expect(result.maxTemp).toBe(37.4);
    });

    it("evaluates day as FEVER_DAY if any reading is at or above threshold", () => {
      const readings = [
        { valueC: 37.2, localDate: todayStr },
        { valueC: 38.1, localDate: todayStr }, // fever!
        { valueC: 36.9, localDate: todayStr },
      ];
      const result = evaluateDay(readings, 38.0);
      expect(result.status).toBe("FEVER_DAY");
      expect(result.maxTemp).toBe(38.1);
    });

    it("respects exact threshold boundary (38.0 is fever)", () => {
      const readings = [{ valueC: 38.0, localDate: todayStr }];
      const result = evaluateDay(readings, 38.0);
      expect(result.status).toBe("FEVER_DAY");
    });
  });

  describe("Fever-Free Streak Calculation", () => {
    it("returns streak = 0 when no readings exist", () => {
      const { streak } = calculateStreak([], 38.0, todayStr);
      expect(streak).toBe(0);
    });

    it("counts consecutive completed fever-free days up to today", () => {
      const readings = [
        { valueC: 36.8, localDate: todayStr },
        { valueC: 36.9, localDate: yesterdayStr },
        { valueC: 37.0, localDate: twoDaysAgoStr },
      ];
      const { streak, feverFreeDates } = calculateStreak(readings, 38.0, todayStr);
      expect(streak).toBe(3);
      expect(feverFreeDates.length).toBe(3);
    });

    it("streak is broken immediately by any fever day", () => {
      const readings = [
        { valueC: 36.8, localDate: todayStr },
        { valueC: 38.4, localDate: yesterdayStr }, // FEVER breaks streak!
        { valueC: 36.9, localDate: twoDaysAgoStr },
        { valueC: 37.0, localDate: threeDaysAgoStr },
      ];
      const { streak } = calculateStreak(readings, 38.0, todayStr);
      expect(streak).toBe(1); // Only today counts
    });

    it("missed / unknown day breaks the streak", () => {
      const readings = [
        { valueC: 36.8, localDate: todayStr },
        // yesterdayStr missing!
        { valueC: 36.9, localDate: twoDaysAgoStr },
        { valueC: 37.0, localDate: threeDaysAgoStr },
      ];
      const { streak } = calculateStreak(readings, 38.0, todayStr);
      expect(streak).toBe(1); // yesterday missed, breaks streak
    });

    it("calculates streak from previous days if today not yet measured", () => {
      const readings = [
        { valueC: 36.8, localDate: yesterdayStr },
        { valueC: 36.9, localDate: twoDaysAgoStr },
        { valueC: 37.0, localDate: threeDaysAgoStr },
      ];
      // todayStr has NO reading
      const { streak } = calculateStreak(readings, 38.0, todayStr);
      expect(streak).toBe(3);
    });
  });

  describe("Pipeline Gating & Patient State", () => {
    it("defaults to NEEDS_TEMP when patient has no reading today", () => {
      const evalResult = determinePipeline({
        patientStatus: "UNDER_TREATMENT",
        readings: [{ valueC: 37.0, localDate: yesterdayStr }],
        hasVisitToday: false,
        todayStr,
        currentHour: 10,
      });

      expect(evalResult.state).toBe("NEEDS_TEMP");
      expect(evalResult.canDoctorVisit).toBe(false); // Doctor blocked!
      expect(evalResult.isOverdueTemp).toBe(false);
    });

    it("flags OVERDUE_TEMP when past 12:00 cutoff and unmeasured", () => {
      const evalResult = determinePipeline({
        patientStatus: "UNDER_TREATMENT",
        readings: [{ valueC: 37.0, localDate: yesterdayStr }],
        hasVisitToday: false,
        todayStr,
        currentHour: 13, // Past 12:00!
      });

      expect(evalResult.state).toBe("NEEDS_TEMP");
      expect(evalResult.isOverdueTemp).toBe(true);
    });

    it("transitions to READY_FOR_DOCTOR when today's reading exists", () => {
      const evalResult = determinePipeline({
        patientStatus: "UNDER_TREATMENT",
        readings: [
          { valueC: 37.0, localDate: yesterdayStr },
          { valueC: 37.2, localDate: todayStr },
        ],
        hasVisitToday: false,
        todayStr,
        currentHour: 11,
      });

      expect(evalResult.state).toBe("READY_FOR_DOCTOR");
      expect(evalResult.canDoctorVisit).toBe(true);
    });

    it("transitions to SEEN once doctor logs visit", () => {
      const evalResult = determinePipeline({
        patientStatus: "UNDER_TREATMENT",
        readings: [{ valueC: 37.2, localDate: todayStr }],
        hasVisitToday: true,
        todayStr,
        currentHour: 14,
      });

      expect(evalResult.state).toBe("SEEN");
      expect(evalResult.canDoctorVisit).toBe(false);
    });

    it("overrides to DISCHARGE_ELIGIBLE when streak >= 3", () => {
      const readings = [
        { valueC: 36.8, localDate: todayStr },
        { valueC: 36.9, localDate: yesterdayStr },
        { valueC: 37.0, localDate: twoDaysAgoStr },
      ];
      const evalResult = determinePipeline({
        patientStatus: "UNDER_TREATMENT",
        readings,
        hasVisitToday: true,
        todayStr,
      });

      expect(evalResult.state).toBe("DISCHARGE_ELIGIBLE");
      expect(evalResult.streak).toBe(3);
      expect(evalResult.isEligibleForDischarge).toBe(true);
    });
  });

  describe("Wilson 95% Confidence Interval & Benchmark Quality Control", () => {
    it("handles zero closed cases safely without division by zero", () => {
      const result = calculateWilsonCI(0, 0, 0.15);
      expect(result.observedRate).toBe(0);
      expect(result.status).toBe("GREEN");
      expect(result.sampleSize).toBe(0);
    });

    it("returns GREEN when observed mortality is at or below 15% benchmark", () => {
      // 10 deaths, 90 recoveries => 10% mortality (below 15%)
      const result = calculateWilsonCI(10, 90, 0.15);
      expect(result.observedRate).toBeCloseTo(0.10);
      expect(result.status).toBe("GREEN");
    });

    it("returns AMBER when rate > 15% but lower bound is below 15% (small sample)", () => {
      // 2 deaths, 8 recoveries => 20% observed mortality
      // With small n=10, 95% CI lower bound is around 5% (< 15%)
      const result = calculateWilsonCI(2, 8, 0.15);
      expect(result.observedRate).toBeCloseTo(0.20);
      expect(result.lowerBound).toBeLessThan(0.15);
      expect(result.status).toBe("AMBER");
    });

    it("returns RED when mortality is statistically significantly above 15%", () => {
      // 35 deaths, 65 recoveries => 35% observed mortality in 100 cases
      // 95% CI lower bound will be well above 15%
      const result = calculateWilsonCI(35, 65, 0.15);
      expect(result.observedRate).toBeCloseTo(0.35);
      expect(result.lowerBound).toBeGreaterThan(0.15);
      expect(result.status).toBe("RED");
    });
  });

  describe("7-Day Streak History Helper", () => {
    it("produces exactly 7 days of history", () => {
      const history = getStreakHistory(
        [
          { valueC: 36.8, localDate: todayStr },
          { valueC: 38.5, localDate: yesterdayStr },
        ],
        38.0,
        todayStr,
        7
      );

      expect(history.length).toBe(7);
      expect(history[history.length - 1].status).toBe("FEVER_FREE"); // Today
      expect(history[history.length - 2].status).toBe("FEVER"); // Yesterday
      expect(history[0].status).toBe("UNKNOWN"); // 6 days ago (no reading)
    });
  });
});

