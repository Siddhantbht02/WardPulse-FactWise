"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  HeartPulse,
  Clock,
  Sparkles,
  CheckCircle2,
  Flame,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  FileText,
  AlertOctagon,
  X,
  RefreshCw,
  Send,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useApp } from "@/components/AppContext";
import { StreakDots } from "@/components/StreakDots";
import { PipelineBadge } from "@/components/PipelineBadge";
import { formatTemp } from "@/lib/utils";

interface DoctorPatient {
  id: string;
  name: string;
  age: number;
  sex: string;
  roomId: number;
  roomNumber: string;
  section: string;
  severity: string;
  symptoms?: string | null;
  admittedAt: string;
  latestTemp: number | null;
  todayTemp: number | null;
  todayVisit: boolean;
  hasPendingTempRequest: boolean;
  readings?: any[];
  dischargeConfirmedBy?: string | null;
  pipeline: any;
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const { user, addToast, refreshTrigger, triggerRefresh, playAlertSound } = useApp();

  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ready" | "waiting" | "seen" | "discharge" | "all">("ready");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Visit Form Drawer / Modal
  const [selectedPatient, setSelectedPatient] = useState<DoctorPatient | null>(null);
  const [clinicalNote, setClinicalNote] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [medication, setMedication] = useState("");
  const [confirmDischargeDuringVisit, setConfirmDischargeDuringVisit] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);

  // Mark Deceased Modal
  const [deceasedModalPatient, setDeceasedModalPatient] = useState<DoctorPatient | null>(null);
  const [deceasedCause, setDeceasedCause] = useState("");
  const [deceasedConfirm, setDeceasedConfirm] = useState("");
  const [markingDeceased, setMarkingDeceased] = useState(false);

  // Load patients
  useEffect(() => {
    setLoading(true);
    fetch("/api/patients")
      .then((r) => r.json())
      .then((data) => {
        if (data?.rooms) {
          const list: DoctorPatient[] = [];
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
        }
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  // Derived Summary Counts
  const counts = useMemo(() => {
    let ready = 0;
    let waiting = 0;
    let seen = 0;
    let dischargeEligible = 0;

    patients.forEach((p) => {
      if (p.pipeline?.isEligibleForDischarge) dischargeEligible++;

      if (p.todayTemp && !p.todayVisit) {
        ready++;
      } else if (!p.todayTemp) {
        waiting++;
      } else if (p.todayVisit) {
        seen++;
      }
    });

    return { ready, waiting, seen, dischargeEligible, total: patients.length };
  }, [patients]);

  // Priority Sort for "Ready for me":
  // 1. Fever today (>= 38.0) first
  // 2. Highest temperature descending
  // 3. Room numerical order
  const sortedReadyPatients = useMemo(() => {
    const readyOnly = patients.filter((p) => p.todayTemp && !p.todayVisit);
    return readyOnly.sort((a, b) => {
      const tempA = a.todayTemp || 0;
      const tempB = b.todayTemp || 0;
      if (tempA >= 38.0 && tempB < 38.0) return -1;
      if (tempA < 38.0 && tempB >= 38.0) return 1;
      return tempB - tempA;
    });
  }, [patients]);

  // Filtered patients based on active tab
  const tabPatients = useMemo(() => {
    let list: DoctorPatient[] = [];

    if (activeTab === "ready") {
      list = sortedReadyPatients;
    } else if (activeTab === "waiting") {
      list = patients.filter((p) => !p.todayTemp);
    } else if (activeTab === "seen") {
      list = patients.filter((p) => p.todayVisit);
    } else if (activeTab === "discharge") {
      list = patients.filter((p) => p.pipeline?.isEligibleForDischarge);
    } else {
      list = patients;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.roomNumber.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }

    return list;
  }, [patients, sortedReadyPatients, activeTab, searchQuery]);

  // Request Temperature Action
  const handleRequestTemperature = async (patientId: string, roomNumber: string) => {
    try {
      const res = await fetch("/api/temp-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, priority: "URGENT" }),
      });

      if (res.ok) {
        addToast({
          type: "success",
          message: `Priority temperature requested for Room ${roomNumber}. Nurse notified.`,
        });
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Failed to request temperature" });
      }
    } catch {
      addToast({ type: "error", message: "Network error requesting temperature" });
    }
  };

  // Quick Clinical Templates
  const applyTemplate = (type: string) => {
    if (type === "stable") {
      setClinicalNote("Vitals stable. Lungs clear bilaterally. Hydration adequate. Continue current regimen.");
      setTreatmentPlan("Standard quarantine isolation. Monitor daily temperatures.");
      setMedication("Supportive vitamins, oral fluids.");
      setConfirmDischargeDuringVisit(false);
    } else if (type === "fever") {
      setClinicalNote("Persistent fever spike noted. Mild tachypnea. Mild chest tightness.");
      setTreatmentPlan("Initiate antipyretic protocol. Strict bed rest. Re-measure vitals in 4 hours.");
      setMedication("IV Paracetamol 1g, normal saline 500ml IV.");
      setConfirmDischargeDuringVisit(false);
    } else if (type === "cured") {
      setClinicalNote("Patient has achieved sustained 3 full fever-free days. Clinical recovery complete.");
      setTreatmentPlan("Fit for discharge. Clearance granted to administration.");
      setMedication("Multivitamin 30d course.");
      setConfirmDischargeDuringVisit(true);
    }
  };

  // Direct Discharge Confirmation (Doctor Sign-off)
  const handleConfirmDischarge = async (patientId: string, roomNumber: string, patientName: string) => {
    try {
      const res = await fetch("/api/discharge/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          type: "success",
          message: `Discharge clearance certified for ${patientName} (Room ${roomNumber})! Forwarded to Admin Portal.`,
        });
        triggerRefresh();
      } else {
        addToast({ type: "error", message: data.error || "Failed to confirm discharge" });
      }
    } catch {
      addToast({ type: "error", message: "Network error confirming discharge" });
    }
  };

  // Submit Doctor Visit
  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!clinicalNote.trim()) {
      addToast({ type: "error", message: "Please provide clinical notes for the round." });
      return;
    }

    setSavingVisit(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          clinicalNote,
          treatmentPlan,
          medication,
          confirmDischarge: confirmDischargeDuringVisit,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        addToast({
          type: "success",
          message: `Clinical round logged for ${selectedPatient.name} (Room ${selectedPatient.roomNumber}). Moved to SEEN.`,
        });
        setSelectedPatient(null);
        setClinicalNote("");
        setTreatmentPlan("");
        setMedication("");
        setConfirmDischargeDuringVisit(false);
        triggerRefresh();
      } else {
        addToast({ type: "error", message: resData.error || "Failed to log visit" });
      }
    } catch {
      addToast({ type: "error", message: "Network error saving visit" });
    } finally {
      setSavingVisit(false);
    }
  };

  // Mark Deceased Submit
  const handleMarkDeceased = async () => {
    if (!deceasedModalPatient || deceasedConfirm.trim().toUpperCase() !== "CONFIRM") return;
    setMarkingDeceased(true);
    try {
      const res = await fetch(`/api/patients/${deceasedModalPatient.id}/deceased`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typedConfirmation: deceasedConfirm,
          cause: deceasedCause,
        }),
      });

      if (res.ok) {
        addToast({ type: "warning", message: "Clinical mortality certified. Room freed for sanitation." });
        setDeceasedModalPatient(null);
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Failed" });
      }
    } catch {
      addToast({ type: "error", message: "Error" });
    } finally {
      setMarkingDeceased(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Physician Clinical Rounds
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold border border-sky-300">
              Pipeline Gated
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Doctor visits are gated until today's temperature is recorded. High fever cases prioritized.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveTab("ready")}
          className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 shadow-xs cursor-pointer hover:border-sky-400 transition-colors"
        >
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-300 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Ready for You</span>
            <Stethoscope className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-sky-800 dark:text-sky-200">{counts.ready}</div>
          <span className="text-[11px] text-sky-600 font-medium">Temp recorded, needs visit</span>
        </div>

        <div
          onClick={() => setActiveTab("waiting")}
          className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-xs cursor-pointer hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Waiting for Temp</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-200">{counts.waiting}</div>
          <span className="text-[11px] text-amber-600 font-medium">Gated from rounds</span>
        </div>

        <div
          onClick={() => setActiveTab("seen")}
          className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Seen Today</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{counts.seen}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Rounds finished</span>
        </div>

        <div
          onClick={() => setActiveTab("discharge")}
          className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-xs cursor-pointer hover:border-purple-400 transition-colors"
        >
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Discharge Ready</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-purple-800 dark:text-purple-200">{counts.dischargeEligible}</div>
          <span className="text-[11px] text-purple-600 font-medium">3 fever-free days</span>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 sm:border-b-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ready")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all whitespace-nowrap ${
              activeTab === "ready"
                ? "border-sky-600 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Ready for Me ({counts.ready})
          </button>
          <button
            onClick={() => setActiveTab("waiting")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all whitespace-nowrap ${
              activeTab === "waiting"
                ? "border-sky-600 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Waiting for Temp ({counts.waiting})
          </button>
          <button
            onClick={() => setActiveTab("seen")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all whitespace-nowrap ${
              activeTab === "seen"
                ? "border-sky-600 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Seen Today ({counts.seen})
          </button>
          <button
            onClick={() => setActiveTab("discharge")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all whitespace-nowrap ${
              activeTab === "discharge"
                ? "border-sky-600 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Discharge Ready ({counts.dischargeEligible})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-2.5 sm:pb-0 px-3 text-xs sm:text-sm font-bold border-b-2 sm:border-b-0 transition-all whitespace-nowrap ${
              activeTab === "all"
                ? "border-sky-600 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            All Inpatients ({counts.total})
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

      {/* Patient Worklist */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-slate-200 dark:bg-slate-750 rounded" />
                <div className="h-3 w-48 bg-slate-200 dark:bg-slate-750 rounded" />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-750 rounded" />
                <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : tabPatients.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {activeTab === "ready" ? "All Ready Patients Seen! Excellent." : "No patients found in this tab."}
          </h3>
          <p className="text-xs text-slate-500">Check back after nurses complete pending temperature rounds.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {tabPatients.map((p) => {
            const hasTemp = !!p.todayTemp;
            const isFever = p.todayTemp && p.todayTemp >= 38.0;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 bg-white dark:bg-slate-800 shadow-xs ${
                  isFever
                    ? "border-red-400 bg-red-50/20"
                    : p.todayVisit
                    ? "border-emerald-200"
                    : hasTemp
                    ? "border-sky-300"
                    : "border-slate-200 dark:border-slate-700 opacity-90"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs">
                        {p.roomNumber}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate" title={p.name}>
                        {p.name}
                      </h3>
                    </div>

                    {isFever ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-extrabold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-red-600" />
                        <span>Fever Spike</span>
                      </span>
                    ) : hasTemp ? (
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                        Temp Ready
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Awaiting Temp
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p>{p.age}y {p.sex} • Severity: <span className="font-semibold">{p.severity}</span></p>

                    {/* Today's Reading Highlight */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-400">Today's Temperature:</span>
                      <span
                        className={`font-mono font-bold ${
                          isFever ? "text-red-600 text-sm" : hasTemp ? "text-emerald-600" : "text-amber-600 italic"
                        }`}
                      >
                        {hasTemp ? formatTemp(p.todayTemp || 0) : "Not yet measured"}
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700">
                      <StreakDots streak={p.pipeline?.streak || 0} requiredDays={3} />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/patients/${p.id}`}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-bold"
                  >
                    View Chart
                  </Link>

                  {/* DIRECT DISCHARGE CONFIRMATION BUTTON FOR 3-DAY CURED PATIENTS */}
                  {(p.pipeline?.isEligibleForDischarge || (p.pipeline?.streak || 0) >= 3) && (
                    <button
                      onClick={() => handleConfirmDischarge(p.id, p.roomNumber, p.name)}
                      className="btn-touch px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      title="Confirm 3-day fever-free discharge clearance to Admin Portal"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{p.dischargeConfirmedBy ? "Discharge Certified ✓" : "Confirm Discharge"}</span>
                    </button>
                  )}

                  {/* STRICT PIPELINE GATING: CANNOT LOG VISIT IF NO TEMP TODAY! */}
                  {hasTemp ? (
                    <button
                      onClick={() => {
                        setSelectedPatient(p);
                        setClinicalNote("");
                        setTreatmentPlan("");
                        setMedication("");
                        setConfirmDischargeDuringVisit(Boolean(p.pipeline?.isEligibleForDischarge || (p.pipeline?.streak || 0) >= 3));
                      }}
                      className="btn-touch flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Stethoscope className="w-4 h-4" />
                      <span>{p.todayVisit ? "Update Notes" : "Log Visit"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRequestTemperature(p.id, p.roomNumber)}
                      className="btn-touch flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      title="Gated: doctor visit disabled until temperature recorded. Pings nurse worklist."
                    >
                      <Clock className="w-4 h-4" />
                      <span>Request Temp Now</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Visit Form Modal / Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Room {selectedPatient.roomNumber} Clinical Round
                </span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {selectedPatient.name} ({selectedPatient.age}y {selectedPatient.sex})
                </h3>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVisit} className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Today's Temperature Summary Chip */}
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-sky-600 uppercase font-bold block">Today's Temperature Reading:</span>
                  <span className="font-mono font-extrabold text-lg text-slate-900 dark:text-white">
                    {formatTemp(selectedPatient.todayTemp || 0)}
                  </span>
                </div>
                <StreakDots streak={selectedPatient.pipeline?.streak || 0} requiredDays={3} />
              </div>

              {/* Quick Clinical Note Template Chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Quick Note Templates
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyTemplate("stable")}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    Stable / Routine Round
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate("fever")}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-800"
                  >
                    Fever Spike / IV Antipyretic
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate("cured")}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 hover:bg-purple-200 text-purple-800"
                  >
                    Discharge Clearance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical Examination & Progress Notes *
                </label>
                <textarea
                  rows={3}
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder="Record lung sounds, vitals evolution, hydration, symptoms..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nursing Orders / Treatment Plan
                </label>
                <input
                  type="text"
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="e.g. Check vitals Q4H, maintain hydration"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Medication / Prescriptions
                </label>
                <input
                  type="text"
                  value={medication}
                  onChange={(e) => setMedication(e.target.value)}
                  placeholder="e.g. Paracetamol 650mg SOS, Vitamin C 500mg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              {(selectedPatient.pipeline?.isEligibleForDischarge || (selectedPatient.pipeline?.streak || 0) >= 3) && (
                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="confirmDischargeCheck"
                    checked={confirmDischargeDuringVisit}
                    onChange={(e) => setConfirmDischargeDuringVisit(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <label htmlFor="confirmDischargeCheck" className="text-xs font-bold text-purple-900 dark:text-purple-200 cursor-pointer">
                    Certify 3-day fever-free recovery & notify Admin Portal for room discharge
                  </label>
                </div>
              )}

              <div className="pt-2 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingVisit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Clinical Round & Mark Seen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

