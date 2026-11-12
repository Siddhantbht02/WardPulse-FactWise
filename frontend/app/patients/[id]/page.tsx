"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HeartPulse,
  Stethoscope,
  Sparkles,
  ArrowLeft,
  Calendar,
  Clock,
  Phone,
  Bed,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Send,
  MoveRight,
  ShieldAlert,
  FileText,
  Activity,
  X,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useApp } from "@/components/AppContext";
import { StreakDots } from "@/components/StreakDots";
import { PipelineBadge } from "@/components/PipelineBadge";
import { formatTemp } from "@/lib/utils";

interface PatientDetails {
  patient: any;
  pipeline: any;
  streakHistory?: Array<{
    dateStr: string;
    dayLabel: string;
    status: "FEVER" | "FEVER_FREE" | "UNKNOWN";
    maxTemp: number | null;
    isToday: boolean;
  }>;
  timeline?: Array<{
    id: string;
    type: string;
    timestamp: string;
    title: string;
    description: string;
    actor: string;
    details?: any;
  }>;
  threshold?: number;
  requiredStreak?: number;
  todayStr?: string;
  settings?: any;
}

export default function PatientDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, addToast, refreshTrigger, triggerRefresh } = useApp();

  const [data, setData] = useState<PatientDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & Forms
  const [showDoctorVisitModal, setShowDoctorVisitModal] = useState(false);
  const [clinicalNote, setClinicalNote] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [medication, setMedication] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);

  const [showDeceasedModal, setShowDeceasedModal] = useState(false);
  const [deceasedConfirmText, setDeceasedConfirmText] = useState("");
  const [deceasedCause, setDeceasedCause] = useState("");
  const [markingDeceased, setMarkingDeceased] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [freeRooms, setFreeRooms] = useState<any[]>([]);
  const [targetRoomId, setTargetRoomId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Load details
  useEffect(() => {
    setLoading(true);
    fetch(`/api/patients/${params.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.patient) setData(res);
      })
      .finally(() => setLoading(false));
  }, [params.id, refreshTrigger]);

  // Request Temperature Action (Doctor)
  const handleRequestTemp = async () => {
    try {
      const res = await fetch("/api/temp-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: params.id, priority: "URGENT" }),
      });
      if (res.ok) {
        addToast({ type: "success", message: "Urgent temperature requested from nursing staff." });
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Request failed" });
      }
    } catch {
      addToast({ type: "error", message: "Error requesting temperature" });
    }
  };

  // Submit Doctor Visit
  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicalNote.trim()) {
      addToast({ type: "error", message: "Clinical note cannot be empty." });
      return;
    }

    setSavingVisit(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: params.id,
          clinicalNote,
          treatmentPlan,
          medication,
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        addToast({ type: "success", message: "Clinical visit recorded! Patient moved to SEEN." });
        setShowDoctorVisitModal(false);
        setClinicalNote("");
        setTreatmentPlan("");
        setMedication("");
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

  // Mark Deceased (Doctor Only)
  const handleMarkDeceased = async () => {
    if (deceasedConfirmText.trim().toUpperCase() !== "CONFIRM") {
      addToast({ type: "error", message: "Please type 'CONFIRM' to certify mortality." });
      return;
    }

    setMarkingDeceased(true);
    try {
      const res = await fetch(`/api/patients/${params.id}/deceased`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typedConfirmation: deceasedConfirmText,
          cause: deceasedCause,
        }),
      });

      if (res.ok) {
        addToast({ type: "warning", message: "Clinical mortality certified. Room freed to cleaning." });
        setShowDeceasedModal(false);
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Failed to certify mortality" });
      }
    } catch {
      addToast({ type: "error", message: "Network error" });
    } finally {
      setMarkingDeceased(false);
    }
  };

  // Open Room Transfer Modal
  const openTransferModal = async () => {
    setShowTransferModal(true);
    const r = await fetch("/api/patients").then((res) => res.json());
    if (r?.rooms) {
      const free = r.rooms.filter((rm: any) => rm.room.status === "FREE").map((rm: any) => rm.room);
      setFreeRooms(free);
      if (free.length > 0) setTargetRoomId(String(free[0].id));
    }
  };

  const handleTransferSubmit = async () => {
    if (!targetRoomId) return;
    setTransferring(true);
    try {
      const res = await fetch(`/api/patients/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRoomId }),
      });

      if (res.ok) {
        addToast({ type: "success", message: "Patient transferred successfully!" });
        setShowTransferModal(false);
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Transfer failed" });
      }
    } catch {
      addToast({ type: "error", message: "Error during room transfer" });
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-500">Loading patient record...</div>;
  }

  if (!data) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-base font-bold text-slate-800">Patient record not found.</p>
        <Link href="/patients" className="text-sm font-semibold text-sky-600 hover:underline">
          ← Return to Patient Directory
        </Link>
      </div>
    );
  }

  const patient = data.patient || {};
  const pipeline = data.pipeline || {};
  const threshold = typeof data.threshold === "number" ? data.threshold : (data.settings?.feverThreshold ?? 38.0);
  const requiredStreak = typeof data.requiredStreak === "number" ? data.requiredStreak : (data.settings?.requiredFeverFreeDays ?? 3);
  const streakHistory = Array.isArray(data.streakHistory)
    ? data.streakHistory
    : Array.isArray(pipeline?.streakHistory)
    ? pipeline.streakHistory
    : [];
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const isFeverFreeStreakGoalMet = (pipeline?.streak || 0) >= requiredStreak;
  const dayOfStay = Math.max(
    1,
    Math.ceil((Date.now() - new Date(patient.admittedAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
  );

  // Prepare temperature chart data (chronological order)
  const chartData = [...(patient.readings || [])]
    .sort((a: any, b: any) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((r: any) => ({
      time: new Date(r.recordedAt).toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
            new Date(r.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      temp: typeof r.valueC === "number" ? r.valueC : Number(r.valueC || 0),
      isRemeasure: r.isRemeasure,
    }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Top Breadcrumb & Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Patients</span>
        </Link>

        {patient.room && user?.role === "ADMIN" && (
          <button
            onClick={openTransferModal}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Bed className="w-3.5 h-3.5 text-slate-500" />
            <span>Transfer Room</span>
          </button>
        )}
      </div>

      {/* Patient Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-sm tracking-wide">
              {patient.room?.roomNumber || "No Room"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{patient.name}</h1>
                <span className="text-xs text-slate-500">
                  {patient.age} years • {patient.sex}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Day {dayOfStay} of Quarantine Stay • Admitted {new Date(patient.admittedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {pipeline && (
              <PipelineBadge
                state={pipeline.state}
                isOverdueTemp={pipeline.isOverdueTemp}
                isOverdueDoctor={pipeline.isOverdueDoctor}
              />
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              Severity: {patient.severity}
            </span>
          </div>
        </div>

        {/* Symptoms & Emergency Contact Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs">
          <div>
            <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Symptoms / Clinical Presentation:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{patient.symptoms || "Prolonged quarantine observation"}</span>
          </div>
          <div>
            <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Emergency Family Contact:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {user?.role === "NURSE" ? "Family / Spouse (Partially Masked)" : patient.emergencyContact}
            </span>
          </div>
        </div>
      </div>

      {/* 7-Day Fever-Free Streak Tracker */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 dark:from-slate-800 dark:to-slate-850 border border-purple-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Consecutive Fever-Free Discharge Tracker</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Strict clinical cure rule: Requires {requiredStreak} consecutive calendar days without a fever (≥ {(threshold ?? 38).toFixed(1)}°C).
            </p>
          </div>

          <div className="self-start sm:self-auto">
            <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 text-xs font-extrabold border border-purple-300 shadow-xs">
              Current Streak: {pipeline?.streak || 0} of {requiredStreak} Days
            </span>
          </div>
        </div>

        {/* 7-Day Circle History Visualizer */}
        <div className="grid grid-cols-7 gap-2 pt-2">
          {streakHistory.map((day: any) => {
            const isFever = day.status === "FEVER";
            const isFeverFree = day.status === "FEVER_FREE";
            const isUnknown = day.status === "UNKNOWN";

            return (
              <div
                key={day.dateStr}
                className={`p-2 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  isFever
                    ? "bg-red-100 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                    : isFeverFree
                    ? "bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300"
                    : "bg-white/60 border-slate-200 text-slate-400 dark:bg-slate-800/40"
                }`}
              >
                <span className="text-[10px] font-bold uppercase">{day.dayLabel}</span>
                <div className="w-7 h-7 my-1 rounded-full flex items-center justify-center font-bold text-xs shadow-xs">
                  {isFeverFree ? (
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  ) : isFever ? (
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]">✕</span>
                  ) : (
                    <span className="text-slate-300">•</span>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold">
                  {typeof day?.maxTemp === "number" ? `${day.maxTemp.toFixed(1)}°C` : "No Temp"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Temperature Trend Chart & Reading Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recharts Line Chart with 38.0°C Threshold Line */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <span>Temperature Trend</span>
            </h3>
            <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
              <span className="w-3 h-0.5 bg-red-500 inline-block" /> Threshold ({(threshold ?? 38).toFixed(1)}°C)
            </span>
          </div>

          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No temperature readings recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis domain={[35.0, 41.0]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [`${Number(val || 0).toFixed(1)}°C`, "Temperature"]}
                    labelStyle={{ fontSize: 11, fontWeight: "bold" }}
                  />
                  <ReferenceLine
                    y={threshold ?? 38.0}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Fever Threshold (${(threshold ?? 38).toFixed(1)}°C)`, position: "insideTopRight", fill: "#ef4444", fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#0284c7" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Table of All Recorded Readings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Reading Audit Log ({patient.readings.length})</span>
          </h3>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 text-xs">
            {patient.readings.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No readings logged yet.</div>
            ) : (
              patient.readings.map((r: any) => {
                const isFever = r.valueC >= threshold;
                return (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-sm ${isFever ? "text-red-600" : "text-emerald-600"}`}>
                          {formatTemp(r.valueC)}
                        </span>
                        {r.isRemeasure && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Re-measured
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Recorded by {r.recordedBy.name} • {r.reason || "Routine daily measurement"}
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(r.recordedAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Unified Timeline & Clinical Progress */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Unified Patient Activity Timeline</h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
          {timeline.map((event: any) => {
            return (
              <div key={event.id} className="relative group">
                <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-sky-600 ring-4 ring-white dark:ring-slate-800" />
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{event.title}</h4>
                  <span className="text-[10px] text-slate-400">
                    {new Date(event.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {event.description}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">Actor: {event.actor}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role-Gated Action Bar (Sticky on Mobile, Embedded on Desktop) */}
      <div className="sticky bottom-16 lg:bottom-4 z-30 p-4 rounded-2xl bg-white/95 backdrop-blur dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="text-xs text-slate-400 uppercase font-bold block tracking-wider">Clinical Round Actions</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Current Status: {patient.status}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Nurse Action: Record Temperature */}
          {user?.role === "NURSE" && (
            <Link
              href={`/nurse?patientId=${patient.id}`}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <HeartPulse className="w-4 h-4" />
              <span>Record Temperature</span>
            </Link>
          )}

          {/* Doctor Actions */}
          {user?.role === "DOCTOR" && (
            <>
              {/* Doctor Pipeline Gating: Blocked if no temp today! */}
              {pipeline?.canDoctorVisit ? (
                <button
                  onClick={() => setShowDoctorVisitModal(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>Log Doctor Visit</span>
                </button>
              ) : pipeline?.alreadyMeasuredToday ? (
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">
                  Doctor Round Already Recorded Today
                </span>
              ) : (
                <button
                  onClick={handleRequestTemp}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                  title="Visits are gated until temperature exists. Pings nurse worklist."
                >
                  <Clock className="w-4 h-4" />
                  <span>Request Temperature Now</span>
                </button>
              )}

              {/* Confirm Discharge Sign-off */}
              {isFeverFreeStreakGoalMet && (
                <button
                  onClick={async () => {
                    await fetch("/api/discharge/confirm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ patientId: params.id }),
                    });
                    addToast({ type: "success", message: "Discharge confirmed by physician." });
                    triggerRefresh();
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Confirm Discharge Sign-off</span>
                </button>
              )}

              {/* Mark Deceased (Doctor Only) */}
              <button
                onClick={() => setShowDeceasedModal(true)}
                className="px-3 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Mark Deceased</span>
              </button>
            </>
          )}

          {/* Admin Action: Process Discharge */}
          {user?.role === "ADMIN" && isFeverFreeStreakGoalMet && (
            <Link
              href={`/discharge?room=${patient.room?.roomNumber}`}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Process Discharge & Release Bed</span>
            </Link>
          )}
        </div>
      </div>

      {/* Doctor Visit Modal */}
      {showDoctorVisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Log Physician Clinical Round
                </h3>
              </div>
              <button onClick={() => setShowDoctorVisitModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVisit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical Examination Notes *
                </label>
                <textarea
                  rows={3}
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder="Bilateral chest findings, hydration, symptom evolution..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Treatment & Nursing Plan
                </label>
                <input
                  type="text"
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="e.g. Continue supportive hydration, check vitals Q4H"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Prescription / Medications
                </label>
                <input
                  type="text"
                  value={medication}
                  onChange={(e) => setMedication(e.target.value)}
                  placeholder="e.g. Paracetamol 500mg TDS, Vitamin C"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDoctorVisitModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow flex items-center gap-1.5"
                >
                  {savingVisit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Clinical Round</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Deceased Modal */}
      {showDeceasedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-red-200 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertOctagon className="w-6 h-6" />
              <h3 className="font-bold text-base">Certify Clinical Mortality</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This action is irrevocable. It closes the patient case, marks status as DECEASED, updates statistical mortality reporting, and frees Room {patient.room?.roomNumber} to CLEANING.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Primary Cause</label>
              <input
                type="text"
                value={deceasedCause}
                onChange={(e) => setDeceasedCause(e.target.value)}
                placeholder="e.g. Acute Respiratory Distress Syndrome"
                className="w-full px-3 py-2 rounded-xl border text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-red-600 mb-1">
                Type 'CONFIRM' to certify mortality:
              </label>
              <input
                type="text"
                value={deceasedConfirmText}
                onChange={(e) => setDeceasedConfirmText(e.target.value)}
                placeholder="CONFIRM"
                className="w-full px-3 py-2 rounded-xl border border-red-300 font-mono text-xs font-bold text-red-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeceasedModal(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkDeceased}
                disabled={markingDeceased || deceasedConfirmText.trim().toUpperCase() !== "CONFIRM"}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow disabled:opacity-40"
              >
                Certify & Release Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Transfer Modal (Admin Only) */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-slate-200 dark:bg-slate-900 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Transfer Patient to Free Bed</h3>
            <p className="text-xs text-slate-500">
              Current room: <span className="font-bold">{patient.room?.roomNumber}</span>. Select a sanitized FREE bed to transfer.
            </p>

            {freeRooms.length === 0 ? (
              <p className="text-xs text-amber-600 font-bold">No other free rooms available right now.</p>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Room</label>
                <select
                  value={targetRoomId}
                  onChange={(e) => setTargetRoomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-semibold"
                >
                  {freeRooms.map((fr) => (
                    <option key={fr.id} value={fr.id}>
                      Room {fr.roomNumber} (Wing {fr.section})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferSubmit}
                disabled={transferring || freeRooms.length === 0}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow disabled:opacity-40"
              >
                Transfer Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
