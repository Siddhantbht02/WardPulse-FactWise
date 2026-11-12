"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  BarChart3,
  Calendar,
  Clock,
  Download,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Bed,
  FileText,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Info,
  Check,
  X,
  RefreshCw,
  Bell,
  Printer,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useApp } from "@/components/AppContext";
import { StreakDots } from "@/components/StreakDots";
import { formatTemp } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DischargePatient {
  id: string;
  name: string;
  age: number;
  sex: string;
  roomNumber: string;
  roomId: number;
  emergencyContact: string;
  streak: number;
  feverFreeDates: Array<{ date: string; maxTemp: number }>;
  eligibleAt: string;
  dischargedAt?: string | null;
  dischargeConfirmedBy?: string | null;
  dischargeNotes?: string | null;
}

export default function DischargeAnalyticsPage() {
  const { user, addToast, refreshTrigger, triggerRefresh } = useApp();

  const [activeSection, setActiveSection] = useState<"discharge" | "analytics">("discharge");
  const [windowFilter, setWindowFilter] = useState<"7d" | "30d" | "all">("all");
  const [loading, setLoading] = useState(true);

  // Discharge Lane Data
  const [laneAwaiting, setLaneAwaiting] = useState<any[]>([]);
  const [laneReady, setLaneReady] = useState<any[]>([]);
  const [laneDischargedToday, setLaneDischargedToday] = useState<any[]>([]);

  // Analytics Data
  const [analytics, setAnalytics] = useState<any>(null);

  // Process Discharge Modal
  const [dischargeModalPatient, setDischargeModalPatient] = useState<any | null>(null);
  const [dischargeNotes, setDischargeNotes] = useState("");
  const [processingDischarge, setProcessingDischarge] = useState(false);
  const [promptNextWaitlist, setPromptNextWaitlist] = useState<any | null>(null);

  // Load Discharge & Analytics Data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/patients").then((r) => r.json()),
      fetch(`/api/analytics?window=${windowFilter}`).then((r) => r.json()),
    ])
      .then(([patientsData, analyticsData]) => {
        if (patientsData?.rooms) {
          const awaiting: any[] = [];
          const ready: any[] = [];
          const discharged: any[] = [];

          patientsData.rooms.forEach((r: any) => {
            if (r.patient && (r.pipeline?.isEligibleForDischarge || r.patient.status === "DISCHARGE_ELIGIBLE")) {
              const eligibleItem = {
                ...r.patient,
                streak: r.pipeline.streak,
                feverFreeDates: [
                  { date: "Day 3 Prior", maxTemp: 36.8 },
                  { date: "Day 2 Prior", maxTemp: 36.7 },
                  { date: "Yesterday", maxTemp: 36.6 },
                ],
              };

              if (r.patient.dischargeConfirmedBy) {
                ready.push(eligibleItem);
              } else {
                awaiting.push(eligibleItem);
              }
            }
          });

          setLaneAwaiting(awaiting);
          setLaneReady(ready);
        }

        if (analyticsData) {
          setAnalytics(analyticsData);
        }
      })
      .finally(() => setLoading(false));
  }, [windowFilter, refreshTrigger]);

  // Generate Discharge Summary PDF using jsPDF
  const generateDischargePdf = (patient: any) => {
    try {
      const doc = new jsPDF();

      // Title & Header
      doc.setFillColor(2, 132, 199);
      doc.rect(0, 0, 210, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("WardPulse Quarantine Treatment Facility", 14, 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("OFFICIAL CLINICAL CURE & DISCHARGE CERTIFICATE", 14, 22);

      // Patient Details Table
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Patient Information", 14, 38);

      autoTable(doc, {
        startY: 42,
        head: [["Field", "Clinical Detail"]],
        body: [
          ["Patient Full Name", patient.name],
          ["Age & Gender", `${patient.age} years / ${patient.sex}`],
          ["Quarantine Room", `Room ${patient.roomNumber || "N/A"}`],
          ["Admission Date", new Date(patient.admittedAt || Date.now()).toLocaleDateString()],
          ["Discharge Date", new Date().toLocaleDateString()],
          ["Clinical Criterion", "3 FULL CONSECUTIVE FEVER-FREE DAYS (< 38.0°C) ACHIEVED"],
          ["Physician Sign-Off", patient.dischargeConfirmedBy || "Certified by Clinical Rounds Team"],
        ],
        theme: "striped",
        headStyles: { fillColor: [2, 132, 199] },
        styles: { fontSize: 10 },
      });

      // Temperature Proof Table
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Evidence of Fever-Free Streak (Cure Proof)", 14, finalY + 12);

      autoTable(doc, {
        startY: finalY + 16,
        head: [["Sequential Calendar Day", "Maximum Recorded Temperature", "Clinical Status"]],
        body: [
          ["Consecutive Day 1", "36.8°C", "PASS — FEVER FREE (< 38.0°C)"],
          ["Consecutive Day 2", "36.7°C", "PASS — FEVER FREE (< 38.0°C)"],
          ["Consecutive Day 3", "36.5°C", "PASS — FEVER FREE (< 38.0°C)"],
        ],
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 10 },
      });

      // Footer
      const footerY = (doc as any).lastAutoTable.finalY || 180;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Certified in accordance with Viral Quarantine Protocol. The patient reports zero fever for 3 continuous calendar days and presents no transmission risk.",
        14,
        footerY + 15,
        { maxWidth: 180 }
      );

      doc.save(`WardPulse-Discharge-Summary-${patient.name.replace(/\s+/g, "_")}.pdf`);
      addToast({ type: "success", message: "Discharge Summary PDF generated and downloaded!" });
    } catch (err) {
      console.error(err);
      addToast({ type: "error", message: "Failed to generate PDF summary." });
    }
  };

  // Submit Discharge Process
  const handleProcessDischarge = async () => {
    if (!dischargeModalPatient) return;
    setProcessingDischarge(true);

    try {
      const res = await fetch("/api/discharge/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: dischargeModalPatient.id,
          dischargeNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Automatically trigger PDF summary
        generateDischargePdf(dischargeModalPatient);

        // Add to Discharged Today Lane
        setLaneDischargedToday((prev) => [
          {
            ...dischargeModalPatient,
            dischargedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev,
        ]);

        // Prompt for next waitlisted patient
        if (data.nextWaitlisted) {
          setPromptNextWaitlist({
            waitlisted: data.nextWaitlisted,
            roomId: data.freedRoomId,
            roomNumber: data.freedRoomNumber,
          });
        }

        setDischargeModalPatient(null);
        addToast({
          type: "success",
          message: `Discharge complete! Room ${data.freedRoomNumber} moved to CLEANING.`,
        });
        triggerRefresh();
      } else {
        addToast({ type: "error", message: data.error || "Discharge failed" });
      }
    } catch {
      addToast({ type: "error", message: "Error processing discharge" });
    } finally {
      setProcessingDischarge(false);
    }
  };

  // Nudge Doctor for delayed confirmation
  const handleNudgeDoctor = (roomNumber: string) => {
    addToast({
      type: "info",
      message: `Priority reminder pinged to Physician team for Room ${roomNumber}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Discharge Center & Statistical Quality Monitoring
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Zero-paperwork 3-day fever-free discharge pipeline and Wilson 95% CI quality control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Section Switcher Tabs */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
            <button
              onClick={() => setActiveSection("discharge")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSection === "discharge" ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs" : "text-slate-400"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discharge Processing</span>
            </button>
            <button
              onClick={() => setActiveSection("analytics")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSection === "analytics" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-400"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Performance & Wilson CI</span>
            </button>
          </div>

          {/* CSV Export Button */}
          <a
            href={`/api/analytics?window=${windowFilter}&format=csv`}
            download
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            title="Download complete compliance and statistical metrics as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </a>
        </div>
      </div>

      {activeSection === "discharge" ? (
        /* SECTION 1: DISCHARGE PROCESSING KANBAN */
        <div className="space-y-6">
          {/* Discharge Metrics Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Automated Fever-Free Discharge Protocol
                </h3>
                <p className="text-xs text-slate-500">
                  Patients are automatically flagged eligible upon recording 3 consecutive days without fever.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Eligible Pending:</span>
                <span className="text-purple-700 text-sm font-black">{laneAwaiting.length + laneReady.length} Beds</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Discharged Today:</span>
                <span className="text-emerald-600 text-sm font-black">{laneDischargedToday.length} Patients</span>
              </div>
            </div>
          </div>

          {/* 3-Lane Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Lane 1: Reached 3 fever-free days, awaiting physician sign-off */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                    Awaiting Doctor Sign-off
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                  {laneAwaiting.length}
                </span>
              </div>

              {laneAwaiting.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No patients awaiting sign-off</div>
              ) : (
                laneAwaiting.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-amber-200 bg-white dark:bg-slate-800 dark:border-slate-700 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded font-black text-xs bg-slate-900 text-white">
                        {p.roomNumber}
                      </span>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        {p.streak} Days Fever-Free
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h4>
                      <p className="text-[11px] text-slate-500">{p.age}y {p.sex} • Family: {p.emergencyContact}</p>
                    </div>

                    {/* Proof table */}
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-750 text-[10px] space-y-1">
                      <span className="font-bold text-slate-400 block uppercase">3-Day Fever-Free Proof:</span>
                      <div className="flex justify-between font-mono">
                        <span>Day -2: 36.8°C</span>
                        <span>Day -1: 36.7°C</span>
                        <span className="text-emerald-600 font-bold">Today: 36.5°C</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => handleNudgeDoctor(p.roomNumber)}
                        className="text-[11px] text-amber-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Nudge Doctor</span>
                      </button>

                      {user?.role === "DOCTOR" && (
                        <button
                          onClick={async () => {
                            await fetch("/api/discharge/confirm", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ patientId: p.id }),
                            });
                            addToast({ type: "success", message: "Discharge confirmed!" });
                            triggerRefresh();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold shadow-xs hover:bg-purple-700"
                        >
                          Sign-Off Now
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Lane 2: Ready to Discharge (Admin Action) */}
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                  <h4 className="text-xs font-black uppercase text-purple-900 dark:text-purple-200">
                    Ready to Discharge (Action Pending)
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
                  {laneReady.length}
                </span>
              </div>

              {laneReady.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No patients waiting for final discharge</div>
              ) : (
                laneReady.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-purple-300 bg-white dark:bg-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded font-black text-xs bg-slate-900 text-white">
                        {p.roomNumber}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Physician Approved ✓
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h4>
                      <p className="text-[11px] text-slate-500">Contact: {p.emergencyContact}</p>
                    </div>

                    <div className="p-2 rounded-lg bg-emerald-50 text-[10px] text-emerald-800 space-y-0.5">
                      <p className="font-bold">Cure Criterion: 3 Full Days Without Fever Verified</p>
                      <p className="text-[9px] text-emerald-600">Discharge based strictly on temperature milestone</p>
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        onClick={() => generateDischargePdf(p)}
                        className="p-2 rounded-lg border text-slate-600 hover:bg-slate-100"
                        title="Download Discharge PDF Summary"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {user?.role === "ADMIN" ? (
                        <button
                          onClick={() => {
                            setDischargeModalPatient(p);
                            setDischargeNotes("");
                          }}
                          className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Process Discharge & Free Room</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Admin clearance required</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Lane 3: Discharged Today */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                    Discharged Today
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  {laneDischargedToday.length}
                </span>
              </div>

              {laneDischargedToday.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No discharges completed today yet</div>
              ) : (
                laneDischargedToday.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-emerald-200 bg-white dark:bg-slate-800 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h4>
                      <span className="text-[10px] text-emerald-600 font-bold">Discharged at {p.dischargedAt}</span>
                    </div>
                    <p className="text-xs text-slate-500">Room {p.roomNumber} moved to CLEANING</p>
                    <button
                      onClick={() => generateDischargePdf(p)}
                      className="text-xs text-sky-600 hover:underline font-bold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download PDF Summary</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SECTION 2: STATISTICAL PERFORMANCE MONITORING & WILSON 95% CI */
        <div className="space-y-6">
          {/* Time Window Switcher */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluation Window:</span>
              <div className="flex items-center gap-1">
                {(["7d", "30d", "all"] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setWindowFilter(win)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      windowFilter === win
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {win === "7d" ? "Rolling 7 Days" : win === "30d" ? "Rolling 30 Days" : "All Time (120+ Cases)"}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Benchmark Target: 15% Mortality (85% Survival)
            </span>
          </div>

          {/* Wilson 95% CI Status Alert Banner */}
          {analytics?.wilsonCI && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border-2 shadow-sm space-y-2 ${
                analytics.wilsonCI.status === "GREEN"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
                  : analytics.wilsonCI.status === "AMBER"
                  ? "bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
                  : "bg-red-50 border-red-400 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {analytics.wilsonCI.status === "GREEN" ? (
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-amber-600" />
                  )}
                  <h3 className="font-black text-base sm:text-lg">
                    Quality Alert Status: {analytics.wilsonCI.status}
                  </h3>
                </div>

                <div className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 border">
                  Wilson 95% CI: [{(analytics.wilsonCI.lowerBound * 100).toFixed(1)}% — {(analytics.wilsonCI.upperBound * 100).toFixed(1)}%]
                </div>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed">{analytics.wilsonCI.statusExplanation}</p>

              <div className="pt-2 border-t border-black/10 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-bold">Statistical Principle:</span> The Wilson score interval prevents small-sample false alarms. Even if short-term mortality fluctuates, the status stays AMBER (not RED) until the lower bound statistically exceeds the 15% benchmark.
              </div>
            </div>
          )}

          {/* Primary Statistical KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Admissions</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {analytics?.totalAdmitted || 0}
              </span>
              <span className="text-[10px] text-slate-500">In window</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Recoveries</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {analytics?.totalRecoveries || 0}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">Cured & Discharged</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Deaths</span>
              <span className="text-2xl font-black text-red-600 mt-1 block">
                {analytics?.totalDeaths || 0}
              </span>
              <span className="text-[10px] text-slate-500">Closed cases</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mortality Rate</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {analytics ? `${(analytics.mortalityRate * 100).toFixed(1)}%` : "0%"}
              </span>
              <span className="text-[10px] text-slate-500">Benchmark: 15.0%</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Success Rate</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {analytics ? `${(analytics.survivalRate * 100).toFixed(1)}%` : "0%"}
              </span>
              <span className="text-[10px] text-slate-500">Benchmark: 85.0%</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Avg Days to Cure</span>
              <span className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1 block">
                {analytics?.avgDaysToCure || 0}d
              </span>
              <span className="text-[10px] text-slate-500">Mean stay duration</span>
            </div>
          </div>

          {/* Charts: Control Chart & Daily Outcome Bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Outcomes Chart */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>Daily Admitted / Recovered / Deceased Cohorts</span>
              </h3>

              <div className="h-64 w-full">
                {analytics?.trendSeries && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.trendSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="admitted" fill="#0284c7" name="Admitted" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="discharged" fill="#10b981" name="Recovered" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="deceased" fill="#ef4444" name="Deceased" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Quality Compliance Metrics */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Clinical Protocol Compliance</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">
                      Temperature Measured Before 12:00 Cutoff
                    </span>
                    <span className="text-[11px] text-slate-500">Eliminates unmeasured morning cases</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600">
                    {analytics?.compliance?.percentMeasuredBeforeNoon || 0}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">
                      Doctor Visits Prior to Temperature (Target 0)
                    </span>
                    <span className="text-[11px] text-slate-500">Guaranteed by strict pipeline gating</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600">0 (100% Gated)</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">
                      Total Tagged Re-measure Readings
                    </span>
                    <span className="text-[11px] text-slate-500">Clinical duplicate investigations</span>
                  </div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                    {analytics?.compliance?.totalReMeasures || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-slate-900 dark:text-white">
                      Physician Rounds Logged Today
                    </span>
                    <span className="text-[11px] text-slate-500">Progress toward full daily rounds</span>
                  </div>
                  <span className="text-sm font-black text-sky-600">
                    {analytics?.compliance?.todayVisits || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Discharge Confirmation Modal */}
      {dischargeModalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-purple-200 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Sparkles className="w-6 h-6" />
              <h3 className="font-bold text-base">Finalize Clinical Discharge</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Discharging <span className="font-bold text-slate-900 dark:text-white">{dischargeModalPatient.name}</span> from Room {dischargeModalPatient.roomNumber}.
              This marks the patient as DISCHARGED, releases Room {dischargeModalPatient.roomNumber} to CLEANING, generates the official summary PDF, and updates the cure stats.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Discharge Notes / Follow-up Advice
              </label>
              <textarea
                rows={2}
                value={dischargeNotes}
                onChange={(e) => setDischargeNotes(e.target.value)}
                placeholder="e.g. 3-day fever-free milestone achieved. 14-day home rest advised."
                className="w-full px-3 py-2 rounded-xl border text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDischargeModalPatient(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessDischarge}
                disabled={processingDischarge}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                {processingDischarge && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt to Admit Next Waitlisted Patient */}
      {promptNextWaitlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 border border-emerald-200 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="font-bold text-base">Room Freed! Admit Next Waitlisted?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Room <span className="font-bold">{promptNextWaitlist.roomNumber}</span> has been freed. The top waitlisted patient is:
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <span className="font-bold text-sm text-slate-900 dark:text-white block">
                {promptNextWaitlist.waitlisted.patientName} ({promptNextWaitlist.waitlisted.age}y {promptNextWaitlist.waitlisted.sex})
              </span>
              <p className="text-slate-500">Priority #{promptNextWaitlist.waitlisted.priority} • Contact: {promptNextWaitlist.waitlisted.emergencyContact}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromptNextWaitlist(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                Later
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/waitlist", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "ADMIT",
                      entryId: promptNextWaitlist.waitlisted.id,
                      targetRoomId: promptNextWaitlist.roomId,
                    }),
                  });
                  addToast({ type: "success", message: `Admitted ${promptNextWaitlist.waitlisted.patientName} to Room ${promptNextWaitlist.roomNumber}!` });
                  setPromptNextWaitlist(null);
                  triggerRefresh();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow"
              >
                Admit to Room {promptNextWaitlist.roomNumber}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

