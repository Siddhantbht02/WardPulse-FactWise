/**
 * WardPulse Pure Business Rules Engine
 * All business logic is deterministic, pure, and decoupled from UI or DB.
 */

export interface ReadingItem {
  valueC: number;
  localDate: string; // YYYY-MM-DD
  recordedAt?: Date | string;
}

export interface DayEvaluation {
  localDate: string;
  status: "FEVER_DAY" | "FEVER_FREE_DAY" | "UNKNOWN_DAY";
  maxTemp: number | null;
  readingCount: number;
}

export type PipelineState = 
  | "NEEDS_TEMP" 
  | "READY_FOR_DOCTOR" 
  | "SEEN" 
  | "DISCHARGE_ELIGIBLE" 
  | "DISCHARGED" 
  | "DECEASED";

export interface PipelineEvaluation {
  state: PipelineState;
  isOverdueTemp: boolean;
  isOverdueDoctor: boolean;
  streak: number;
  isEligibleForDischarge: boolean;
  canDoctorVisit: boolean;
  canNurseMeasure: boolean;
  alreadyMeasuredToday: boolean;
}

export interface WilsonCIResult {
  observedRate: number; // 0 to 1
  lowerBound: number;   // 0 to 1
  upperBound: number;   // 0 to 1
  sampleSize: number;
  deaths: number;
  recoveries: number;
  status: "GREEN" | "AMBER" | "RED";
  benchmark: number;
  statusExplanation: string;
}

/**
 * Returns formatted local calendar date string YYYY-MM-DD in the given timezone
 */
export function getFacilityLocalDate(date = new Date(), timezone = "Asia/Kolkata"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Evaluate all readings on a single calendar day
 */
export function evaluateDay(readings: ReadingItem[], threshold = 38.0): Omit<DayEvaluation, "localDate"> {
  if (!readings || readings.length === 0) {
    return {
      status: "UNKNOWN_DAY",
      maxTemp: null,
      readingCount: 0,
    };
  }

  const maxTemp = Math.max(...readings.map((r) => r.valueC));
  const hasFever = readings.some((r) => r.valueC >= threshold);

  return {
    status: hasFever ? "FEVER_DAY" : "FEVER_FREE_DAY",
    maxTemp,
    readingCount: readings.length,
  };
}

/**
 * Calculate the consecutive fever-free calendar day streak.
 * Rule:
 * - Consecutive most-recent recorded calendar days without fever.
 * - Any fever day resets streak to 0.
 * - An unknown day (missed recording) breaks the streak!
 * - If today has a fever-free reading, it counts.
 * - If today has not yet been recorded, the streak reflects previous consecutive days.
 */
export function calculateStreak(
  readings: ReadingItem[],
  threshold = 38.0,
  todayStr: string
): { streak: number; feverFreeDates: string[] } {
  if (!readings || readings.length === 0) {
    return { streak: 0, feverFreeDates: [] };
  }

  // Group readings by localDate
  const byDate: Record<string, ReadingItem[]> = {};
  for (const r of readings) {
    if (!byDate[r.localDate]) byDate[r.localDate] = [];
    byDate[r.localDate].push(r);
  }

  // Parse today as year, month, day
  const today = new Date(`${todayStr}T12:00:00Z`);

  let streak = 0;
  const feverFreeDates: string[] = [];

  // Check if today has readings
  let checkOffset = 0;
  if (!byDate[todayStr] || byDate[todayStr].length === 0) {
    // Today not yet recorded: streak counts up to yesterday
    checkOffset = 1;
  }

  for (let i = checkOffset; i < 30; i++) {
    const targetDate = new Date(today.getTime() - i * 86400000);
    const dateStr = targetDate.toISOString().slice(0, 10);

    const dayReadings = byDate[dateStr];
    if (!dayReadings || dayReadings.length === 0) {
      // Missed / unknown day breaks the streak
      break;
    }

    const evalResult = evaluateDay(dayReadings, threshold);
    if (evalResult.status === "FEVER_FREE_DAY") {
      streak += 1;
      feverFreeDates.push(dateStr);
    } else {
      // Any fever day resets streak
      break;
    }
  }

  return { streak, feverFreeDates };
}

/**
 * Determine pipeline state and gating flags for a patient
 */
export function determinePipeline(params: {
  patientStatus: string; // ADMITTED, UNDER_TREATMENT, DISCHARGE_ELIGIBLE, DISCHARGED, DECEASED
  readings: ReadingItem[];
  hasVisitToday: boolean;
  threshold?: number;
  requiredStreak?: number;
  todayStr: string;
  currentHour?: number; // 0-23 in facility local time
  currentMinute?: number;
  tempCutoffHour?: number; // default 12
  doctorCutoffHour?: number; // default 17
}): PipelineEvaluation {
  const {
    patientStatus,
    readings,
    hasVisitToday,
    threshold = 38.0,
    requiredStreak = 3,
    todayStr,
    currentHour = 10,
    currentMinute = 0,
    tempCutoffHour = 12,
    doctorCutoffHour = 17,
  } = params;

  if (patientStatus === "DISCHARGED") {
    return {
      state: "DISCHARGED",
      isOverdueTemp: false,
      isOverdueDoctor: false,
      streak: 0,
      isEligibleForDischarge: false,
      canDoctorVisit: false,
      canNurseMeasure: false,
      alreadyMeasuredToday: false,
    };
  }

  if (patientStatus === "DECEASED") {
    return {
      state: "DECEASED",
      isOverdueTemp: false,
      isOverdueDoctor: false,
      streak: 0,
      isEligibleForDischarge: false,
      canDoctorVisit: false,
      canNurseMeasure: false,
      alreadyMeasuredToday: false,
    };
  }

  const { streak } = calculateStreak(readings, threshold, todayStr);
  const isEligibleForDischarge = streak >= requiredStreak || patientStatus === "DISCHARGE_ELIGIBLE";

  const todayReadings = readings.filter((r) => r.localDate === todayStr);
  const hasReadingToday = todayReadings.length > 0;

  let state: PipelineState;
  if (isEligibleForDischarge) {
    state = "DISCHARGE_ELIGIBLE";
  } else if (!hasReadingToday) {
    state = "NEEDS_TEMP";
  } else if (!hasVisitToday) {
    state = "READY_FOR_DOCTOR";
  } else {
    state = "SEEN";
  }

  const isPastTempCutoff = currentHour > tempCutoffHour || (currentHour === tempCutoffHour && currentMinute > 0);
  const isPastDoctorCutoff = currentHour > doctorCutoffHour || (currentHour === doctorCutoffHour && currentMinute > 0);

  const isOverdueTemp = !hasReadingToday && isPastTempCutoff;
  const isOverdueDoctor = hasReadingToday && !hasVisitToday && isPastDoctorCutoff;

  return {
    state,
    isOverdueTemp,
    isOverdueDoctor,
    streak,
    isEligibleForDischarge,
    // Doctor can only visit if temperature exists for today!
    canDoctorVisit: hasReadingToday && !hasVisitToday,
    canNurseMeasure: true,
    alreadyMeasuredToday: hasReadingToday,
  };
}

/**
 * Wilson 95% Confidence Interval for quality monitoring against benchmark mortality
 */
export function calculateWilsonCI(
  deaths: number,
  recoveries: number,
  benchmark = 0.15
): WilsonCIResult {
  const n = deaths + recoveries;

  if (n === 0) {
    return {
      observedRate: 0,
      lowerBound: 0,
      upperBound: 0,
      sampleSize: 0,
      deaths: 0,
      recoveries: 0,
      status: "GREEN",
      benchmark,
      statusExplanation: "No closed cases recorded yet. Performance is on track.",
    };
  }

  const p = deaths / n;
  const z = 1.95996; // 95% CI
  const z2 = z * z;

  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;

  const lowerBound = Math.max(0, center - margin);
  const upperBound = Math.min(1, center + margin);

  let status: "GREEN" | "AMBER" | "RED";
  let statusExplanation = "";

  if (p <= benchmark) {
    status = "GREEN";
    statusExplanation = `Observed mortality (${(p * 100).toFixed(1)}%) is at or below the ${(benchmark * 100).toFixed(1)}% benchmark. Normal operating conditions.`;
  } else if (lowerBound <= benchmark) {
    status = "AMBER";
    statusExplanation = `Observed mortality (${(p * 100).toFixed(1)}%) exceeds ${(benchmark * 100).toFixed(1)}%, but the 95% CI lower bound (${(lowerBound * 100).toFixed(1)}%) is below benchmark. Possible statistical noise; monitor closely.`;
  } else {
    status = "RED";
    statusExplanation = `Statistically significant excess mortality! 95% CI lower bound (${(lowerBound * 100).toFixed(1)}%) exceeds the ${(benchmark * 100).toFixed(1)}% benchmark. Immediate clinical review required.`;
  }

  return {
    observedRate: p,
    lowerBound,
    upperBound,
    sampleSize: n,
    deaths,
    recoveries,
    status,
    benchmark,
    statusExplanation,
  };
}

/**
 * Generate 7-day visual history array for patient cards and details
 */
export function getStreakHistory(
  readings: ReadingItem[],
  threshold = 38.0,
  todayStr: string,
  daysCount = 7
): Array<{
  dateStr: string;
  dayLabel: string;
  status: "FEVER" | "FEVER_FREE" | "UNKNOWN";
  maxTemp: number | null;
  isToday: boolean;
}> {
  const byDate: Record<string, ReadingItem[]> = {};
  for (const r of readings) {
    if (!byDate[r.localDate]) byDate[r.localDate] = [];
    byDate[r.localDate].push(r);
  }

  const today = new Date(`${todayStr}T12:00:00Z`);
  const result = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = new Date(today.getTime() - i * 86400000);
    const dateStr = targetDate.toISOString().slice(0, 10);
    const dayName = targetDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

    const dayReadings = byDate[dateStr] || [];
    const evaluation = evaluateDay(dayReadings, threshold);

    let status: "FEVER" | "FEVER_FREE" | "UNKNOWN" = "UNKNOWN";
    if (evaluation.status === "FEVER_DAY") status = "FEVER";
    else if (evaluation.status === "FEVER_FREE_DAY") status = "FEVER_FREE";

    result.push({
      dateStr,
      dayLabel: i === 0 ? "Today" : dayName,
      status,
      maxTemp: evaluation.maxTemp,
      isToday: i === 0,
    });
  }

  return result;
}

