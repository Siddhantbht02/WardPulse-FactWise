"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  HeartPulse,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Flame,
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Undo2,
  CloudOff,
  Cloud,
  Check,
  X,
  RefreshCw,
  Plus,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/components/AppContext";
import { formatTemp } from "@/lib/utils";

interface NursePatient {
  id: string;
  name: string;
  age: number;
  sex: string;
  roomId: number;
  roomNumber: string;
  section: string;
  latestTemp: number | null;
  latestTempTime: string | null;
  todayTemp: number | null;
  todayReadingId?: string;
  todayReadingTime?: string;
  todayReadingUser?: string;
  claim?: {
    id: string;
    nurseId: string;
    nurse: { id: string; name: string };
    expiresAt: string;
  } | null;
  hasPendingTempRequest: boolean;
  pipeline: any;
}

function NurseDashboardContent() {
  const searchParams = useSearchParams();
  const { user, addToast, refreshTrigger, triggerRefresh } = useApp();

  const [patients, setPatients] = useState<NursePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"to-measure" | "done" | "all">("to-measure");
  const [searchQuery, setSearchQuery] = useState("");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");

  // Temperature Entry Modal State
  const [activePatient, setActivePatient] = useState<NursePatient | null>(null);
  const [tempInput, setTempInput] = useState("370"); // default 37.0°C stored as 370
  const [quickNote, setQuickNote] = useState("");
  const [isRemeasureMode, setIsRemeasureMode] = useState(false);
  const [remeasureReason, setRemeasureReason] = useState("Spike suspected");
  const [remeasureCustomText, setRemeasureCustomText] = useState("");
  const [savingTemp, setSavingTemp] = useState(false);
  const [duplicateConflictData, setDuplicateConflictData] = useState<any>(null);

  // 5-min Typo Fix Modal State
  const [typoFixPatient, setTypoFixPatient] = useState<NursePatient | null>(null);
  const [typoFixTemp, setTypoFixTemp] = useState("");
  const [typoFixReason, setTypoFixReason] = useState("");
  const [savingTypoFix, setSavingTypoFix] = useState(false);

  // Load patients
  useEffect(() => {
    setLoading(true);
    fetch("/api/patients")
      .then((r) => r.json())
      .then((data) => {
        if (data?.rooms) {
          const list: NursePatient[] = [];
          data.rooms.forEach((r: any) => {
            if (r.patient) {
              list.push({
                ...r.patient,
                section: r.room.section,
                pipeline: r.pipeline,
              });
            }
          });
          setPatients(list);

          // Check if navigated from patient details with patientId param
          const pid = searchParams.get("patientId");
          if (pid) {
            const found = list.find((p) => p.id === pid);
            if (found) openTempEntryModal(found);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger, searchParams]);

  // Derived Summary Counts
  const counts = useMemo(() => {
    let toMeasure = 0;
    let overdue = 0;
    let doctorRequested = 0;
    let doneToday = 0;

    patients.forEach((p) => {
      if (p.todayTemp) {
        doneToday++;
      } else {
        toMeasure++;
        if (p.pipeline?.isOverdueTemp) overdue++;
        if (p.hasPendingTempRequest) doctorRequested++;
      }
    });

    const percentMeasured = patients.length > 0 ? Math.round((doneToday / patients.length) * 100) : 0;

    return { toMeasure, overdue, doctorRequested, doneToday, percentMeasured, total: patients.length };
  }, [patients]);

  // Priority Sort: Doctor-Requested first, then Overdue, then Section/Room order
  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      // 1. Doctor requested priority
      if (a.hasPendingTempRequest && !b.hasPendingTempRequest) return -1;
      if (!a.hasPendingTempRequest && b.hasPendingTempRequest) return 1;

      // 2. Overdue priority
      if (a.pipeline?.isOverdueTemp && !b.pipeline?.isOverdueTemp) return -1;
      if (!a.pipeline?.isOverdueTemp && b.pipeline?.isOverdueTemp) return 1;

      // 3. Room ID numerical order
      return a.roomId - b.roomId;
    });
  }, [patients]);

  // Filtered by active tab and search
  const tabPatients = useMemo(() => {
    return sortedPatients.filter((p) => {
      if (activeTab === "to-measure" && p.todayTemp) return false;
      if (activeTab === "done" && !p.todayTemp) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoom = p.roomNumber.toLowerCase().includes(q);
        const matchesName = p.name.toLowerCase().includes(q);
        if (!matchesRoom && !matchesName) return false;
      }

      return true;
    });
  }, [sortedPatients, activeTab, searchQuery]);

  // Handle Bed Claim
  const handleClaimBed = async (patientId: string) => {
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });

      if (res.ok) {
        addToast({ type: "success", message: "Bed claimed for 20 minutes." });
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Claim failed" });
      }
    } catch {
      addToast({ type: "error", message: "Error claiming bed" });
    }
  };

  // Handle Release Claim
  const handleReleaseClaim = async (patientId: string) => {
    try {
      const res = await fetch(`/api/claims?patientId=${patientId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "info", message: "Bed claim released." });
        triggerRefresh();
      }
    } catch {}
  };

  // Open Temperature Keypad Modal
  const openTempEntryModal = (p: NursePatient) => {
    setActivePatient(p);
    setTempInput("370"); // 37.0°C default
    setQuickNote("");
    setDuplicateConflictData(null);
    setIsRemeasureMode(false);

    // If already measured today, prepare duplicate prompt
    if (p.todayTemp) {
      setIsRemeasureMode(true);
      setDuplicateConflictData({
        message: `Patient was already measured today at ${formatTemp(p.todayTemp)}. Re-measurement requires a reason.`,
      });
    }
  };

  // Parse entered numeric keypad string e.g. "386" -> 38.6
  const computedValueC = useMemo(() => {
    const num = parseInt(tempInput || "0", 10);
    return Number((num / 10).toFixed(1));
  }, [tempInput]);

  const isFever = computedValueC >= 38.0;

  // Handle Keypad Press
  const handleKeypadPress = (val: string) => {
    if (tempInput.length >= 3 && tempInput.startsWith("0")) {
      setTempInput(tempInput.slice(1) + val);
    } else if (tempInput.length < 3) {
      setTempInput((prev) => prev + val);
    } else {
      // Rotate 3 digits: e.g. "370" -> press 8 -> "708" -> reset to new standard
      setTempInput((prev) => prev.slice(1) + val);
    }
  };

  const handleAdjustTemp = (delta: number) => {
    const next = Math.max(340, Math.min(420, parseInt(tempInput, 10) + delta * 10));
    setTempInput(String(next));
  };

  // Submit Temperature Reading
  const handleSaveTemperature = async () => {
    if (!activePatient) return;

    if (computedValueC < 34.0 || computedValueC > 42.0) {
      addToast({ type: "error", message: "Temperature must be between 34.0°C and 42.0°C." });
      return;
    }

    if (computedValueC < 35.0 || computedValueC > 40.5) {
      if (!confirm(`Warning: Extreme clinical value (${computedValueC}°C). Are you sure?`)) {
        return;
      }
    }

    setSavingTemp(true);
    try {
      const fullReason = isRemeasureMode
        ? `${remeasureReason}${remeasureCustomText ? `: ${remeasureCustomText}` : ""}${quickNote ? ` [${quickNote}]` : ""}`
        : quickNote || undefined;

      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: activePatient.id,
          valueC: computedValueC,
          isRemeasure: isRemeasureMode,
          reason: fullReason,
          idempotencyKey: `${activePatient.id}-${new Date().toISOString().slice(0, 10)}-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Successful entry with 60-second Undo Toast!
        const readingId = data.reading.id;
        addToast({
          type: "success",
          message: `Recorded ${formatTemp(computedValueC)} for ${activePatient.name} (Room ${activePatient.roomNumber}).`,
          undoAction: async () => {
            // Undo within 60s
            await fetch(`/api/readings/${readingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ valueC: 37.0, fixReason: "Nurse undo within 60s" }),
            });
            triggerRefresh();
          },
          undoLabel: "Undo",
        });

        setActivePatient(null);
        triggerRefresh();
      } else if (res.status === 409 && data.isDuplicate) {
        // Prompt Re-measure
        setIsRemeasureMode(true);
        setDuplicateConflictData(data);
      } else {
        addToast({ type: "error", message: data.error || "Failed to record reading" });
      }
    } catch {
      addToast({ type: "error", message: "Network error saving reading" });
    } finally {
      setSavingTemp(false);
    }
  };

  // Submit 5-min Typo Fix
  const handleSaveTypoFix = async () => {
    if (!typoFixPatient || !typoFixPatient.todayReadingId) return;

    const val = parseFloat(typoFixTemp);
    if (isNaN(val) || val < 34.0 || val > 42.0) {
      addToast({ type: "error", message: "Valid temperature between 34.0 and 42.0 required." });
      return;
    }

    setSavingTypoFix(true);
    try {
      const res = await fetch(`/api/readings/${typoFixPatient.todayReadingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valueC: val,
          fixReason: typoFixReason || "Nurse typo fix",
        }),
      });

      if (res.ok) {
        addToast({ type: "success", message: "Typo corrected successfully within 5-min window." });
        setTypoFixPatient(null);
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Typo fix rejected (expired window)" });
      }
    } catch {
      addToast({ type: "error", message: "Error fixing typo" });
    } finally {
      setSavingTypoFix(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Nurse Station Triage
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              Round 1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Single daily temperature measurement per patient. Fast-entry keypad with duplicate protection.
          </p>
        </div>

        {/* Display Temp Unit Toggle (°C / °F) */}
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setTempUnit("C")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tempUnit === "C" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-400"
            }`}
          >
            Celsius (°C)
          </button>
          <button
            onClick={() => setTempUnit("F")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tempUnit === "F" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-400"
            }`}
          >
            Fahrenheit (°F)
          </button>
        </div>
      </div>

      {/* Triage Summary Counters & Ward Progress Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
              <span className="text-xs font-bold uppercase">To Measure</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-800 dark:text-amber-300">{counts.toMeasure}</div>
            <span className="text-[11px] text-amber-600 font-medium">Pending queue</span>
          </div>

          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
            <div className="flex items-center justify-between text-red-700 dark:text-red-400 mb-1">
              <span className="text-xs font-bold uppercase">Overdue Cutoff</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-red-800 dark:text-red-300">{counts.overdue}</div>
            <span className="text-[11px] text-red-600 font-medium">Past 12:00 PM</span>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-1">
              <span className="text-xs font-bold uppercase">Doctor Requested</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-purple-800 dark:text-purple-300">{counts.doctorRequested}</div>
            <span className="text-[11px] text-purple-600 font-medium">Priority triage</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
              <span className="text-xs font-bold uppercase">Done Today</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{counts.doneToday}</div>
            <span className="text-[11px] text-emerald-600 font-medium">Measured</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            <span>Ward Daily Measurement Progress</span>
            <span>{counts.percentMeasured}% ({counts.doneToday}/{counts.total} Patients)</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
              style={{ width: `${counts.percentMeasured}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 sm:border-b-0">
          <button
            onClick={() => setActiveTab("to-measure")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all ${
              activeTab === "to-measure"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            To Measure ({counts.toMeasure})
          </button>
          <button
            onClick={() => setActiveTab("done")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all ${
              activeTab === "done"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Done Today ({counts.doneToday})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all ${
              activeTab === "all"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            All Patients ({counts.total})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search room or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          />
        </div>
      </div>

      {/* Patient Triage Worklist */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">Loading triage queue...</div>
      ) : tabPatients.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {activeTab === "to-measure" ? "All Patients Measured! Great work!" : "No patients found in this tab."}
          </h3>
          <p className="text-xs text-slate-500">All morning rounds have been logged for this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tabPatients.map((p) => {
            const isClaimedByMe = p.claim?.nurseId === user?.id;
            const isClaimedByOther = Boolean(p.claim && !isClaimedByMe);
            const isOverdue = p.pipeline?.isOverdueTemp;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 bg-white dark:bg-slate-800 shadow-xs ${
                  p.hasPendingTempRequest
                    ? "border-amber-400 bg-amber-50/20"
                    : isOverdue
                    ? "border-red-300 bg-red-50/20"
                    : p.todayTemp
                    ? "border-emerald-200"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div>
                  {/* Card Header: Room + Urgent/Overdue Badges */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs">
                        {p.roomNumber}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate" title={p.name}>
                        {p.name}
                      </h3>
                    </div>

                    {p.hasPendingTempRequest ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold animate-pulse">
                        Doctor Requested
                      </span>
                    ) : isOverdue ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-extrabold animate-pulse-fast">
                        Overdue Cutoff
                      </span>
                    ) : null}
                  </div>

                  {/* Patient Subtitle & Last Reading */}
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>{p.age}y {p.sex} • Wing {p.section}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span>Yesterday's / Latest:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {p.latestTemp ? formatTemp(p.latestTemp, tempUnit) : "None"}
                      </span>
                    </div>
                  </div>

                  {/* Bed Claim Status Badge */}
                  {p.claim && (
                    <div className="mt-2 text-[11px] px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold">
                        <Lock className="w-3 h-3" />
                        <span>Claimed by {isClaimedByMe ? "You" : p.claim.nurse.name}</span>
                      </span>
                      {isClaimedByMe && (
                        <button
                          onClick={() => handleReleaseClaim(p.id)}
                          className="text-[10px] underline font-bold hover:text-indigo-900"
                        >
                          Release
                        </button>
                      )}
                    </div>
                  )}

                  {/* Today Reading Status */}
                  {p.todayTemp && (
                    <div className="mt-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Today: {formatTemp(p.todayTemp, tempUnit)}</span>
                      </span>
                      <button
                        onClick={() => {
                          setTypoFixPatient(p);
                          setTypoFixTemp(String(p.todayTemp));
                          setTypoFixReason("");
                        }}
                        className="text-[10px] text-sky-600 hover:underline font-bold"
                      >
                        Typo Fix (5m)
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions: Claim Bed & Record Temp Button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  {!p.claim && (
                    <button
                      onClick={() => handleClaimBed(p.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1"
                      title="Lock bed for 20 mins to prevent walk collisions"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Claim</span>
                    </button>
                  )}

                  <button
                    onClick={() => openTempEntryModal(p)}
                    disabled={isClaimedByOther}
                    className={`btn-touch flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all ${
                      p.todayTemp
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                    } disabled:opacity-40`}
                  >
                    <HeartPulse className="w-4 h-4" />
                    <span>{p.todayTemp ? "Re-measure" : "Record Temp"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Temperature Entry Sheet / Modal (Large Gloved Numeric Keypad) */}
      {activePatient && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Room {activePatient.roomNumber} • Bed Triage
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  {activePatient.name}
                </h3>
              </div>
              <button
                onClick={() => setActivePatient(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Duplicate Protection Warning if already measured */}
              {isRemeasureMode && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Patient Already Measured Today</span>
                  </div>
                  <p>
                    {duplicateConflictData?.error ||
                      `Measured at ${formatTemp(activePatient.todayTemp || 0)}. A clinical re-measure requires a documented reason.`}
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">
                      Mandatory Re-measure Reason *
                    </label>
                    <select
                      value={remeasureReason}
                      onChange={(e) => setRemeasureReason(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white dark:bg-slate-800 text-xs font-bold"
                    >
                      <option value="Spike suspected">Fever Spike Suspected</option>
                      <option value="Post-medication check">Post-Antipyretic / Paracetamol Check</option>
                      <option value="Prior reading dubious">Prior Reading Dubious / Thermometer Re-check</option>
                      <option value="Doctor requested">Physician Requested Re-measurement</option>
                      <option value="Other">Other Clinical Reason</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Large Temperature Display & Live Fever Indicator */}
              <div
                className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                  isFever
                    ? "bg-red-50 border-red-500 text-red-900 dark:bg-red-950/40 dark:border-red-700"
                    : "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-700"
                }`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {isFever ? "🔥 FEVER DETECTED (≥ 38.0°C)" : "✓ NORMAL TEMPERATURE (< 38.0°C)"}
                </span>

                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight">
                    {computedValueC.toFixed(1)}
                  </span>
                  <span className="text-xl font-bold font-mono">°C</span>
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustTemp(-0.1)}
                    className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-xs font-bold shadow-xs border"
                  >
                    -0.1°
                  </button>
                  <span className="text-[11px] text-slate-500">
                    {tempUnit === "F" ? `(${formatTemp(computedValueC, "F")})` : "Type digits below"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustTemp(0.1)}
                    className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-xs font-bold shadow-xs border"
                  >
                    +0.1°
                  </button>
                </div>
              </div>

              {/* Gloved-Hand Friendly Numeric Keypad (Type 386 -> 38.6) */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleKeypadPress(n)}
                    className="btn-touch h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-lg font-bold text-slate-800 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700 active:scale-95 transition-all flex items-center justify-center"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTempInput("370")}
                  className="btn-touch h-12 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  RESET 37.0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="btn-touch h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-lg font-bold text-slate-800 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setTempInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : "370"))}
                  className="btn-touch h-12 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  DEL
                </button>
              </div>

              {/* Quick Observation Chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Quick Observation Note
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Shivering / Chills",
                    "Profuse Sweating",
                    "Refused Food",
                    "Mild Dyspnea",
                    "Patient Sleeping",
                    "Post-Paracetamol 1h",
                  ].map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setQuickNote(quickNote === chip ? "" : chip)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        quickNote === chip
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-300"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleSaveTemperature}
                disabled={savingTemp}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {savingTemp ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                <span>
                  {isRemeasureMode ? "Confirm Re-measure" : `Save ${computedValueC.toFixed(1)}°C & Advance to Doctor`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-Min Typo Fix Modal */}
      {typoFixPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-slate-200 dark:bg-slate-900 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Typo Fix: Room {typoFixPatient.roomNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Permitted only within 5 minutes of entry. Changes are audit-logged.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Corrected Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                min="34.0"
                max="42.0"
                value={typoFixTemp}
                onChange={(e) => setTypoFixTemp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm font-bold font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Correction Reason
              </label>
              <input
                type="text"
                placeholder="e.g. Digit mistyped on keypad"
                value={typoFixReason}
                onChange={(e) => setTypoFixReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTypoFixPatient(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTypoFix}
                disabled={savingTypoFix}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NurseDashboardPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500">Loading nurse triage station...</div>}>
      <NurseDashboardContent />
    </Suspense>
  );
}
