"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  HeartPulse,
  Stethoscope,
  Sparkles,
  Clock,
  AlertTriangle,
  Flame,
  LayoutGrid,
  List,
  UserPlus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { useApp } from "@/components/AppContext";
import { StreakDots } from "@/components/StreakDots";
import { PipelineBadge } from "@/components/PipelineBadge";
import { formatTemp } from "@/lib/utils";

interface RoomItem {
  room: {
    id: number;
    roomNumber: string;
    section: string;
    status: string; // OCCUPIED, FREE, CLEANING
  };
  patient: {
    id: string;
    name: string;
    age: number;
    sex: string;
    emergencyContact: string;
    contactPhone: string;
    symptoms?: string | null;
    severity: string;
    status: string;
    admittedAt: string;
    roomId: number;
    roomNumber: string;
    latestTemp: number | null;
    latestTempTime: string | null;
    todayTemp: number | null;
    todayVisit: boolean;
    claim?: any;
    hasPendingTempRequest: boolean;
  } | null;
  pipeline: {
    state: "NEEDS_TEMP" | "READY_FOR_DOCTOR" | "SEEN" | "DISCHARGE_ELIGIBLE" | "DISCHARGED" | "DECEASED";
    isOverdueTemp: boolean;
    isOverdueDoctor: boolean;
    streak: number;
    isEligibleForDischarge: boolean;
    canDoctorVisit: boolean;
    canNurseMeasure: boolean;
    alreadyMeasuredToday: boolean;
  } | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, refreshTrigger } = useApp();

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [qualityStatus, setQualityStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState<string>("ALL");
  const [filterPipeline, setFilterPipeline] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Fetch rooms & ward state
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/patients").then((r) => r.json()),
      fetch("/api/waitlist").then((r) => r.json()),
      fetch("/api/analytics?window=all").then((r) => r.json()),
    ])
      .then(([patientsData, waitlistData, analyticsData]) => {
        if (patientsData?.rooms) setRooms(patientsData.rooms);
        if (waitlistData?.waitlist) setWaitlistCount(waitlistData.waitlist.length);
        if (analyticsData?.wilsonCI) setQualityStatus(analyticsData.wilsonCI);
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  // Derived KPI counters
  const kpis = useMemo(() => {
    const total = 74;
    const occupied = rooms.filter((r) => r.room.status === "OCCUPIED").length;
    const free = rooms.filter((r) => r.room.status === "FREE").length;
    const cleaning = rooms.filter((r) => r.room.status === "CLEANING").length;

    let needsTemp = 0;
    let readyForDoctor = 0;
    let seen = 0;
    let dischargeEligible = 0;
    let feverToday = 0;
    let overdue = 0;

    rooms.forEach((r) => {
      if (r.patient && r.pipeline) {
        if (r.pipeline.state === "NEEDS_TEMP") needsTemp++;
        else if (r.pipeline.state === "READY_FOR_DOCTOR") readyForDoctor++;
        else if (r.pipeline.state === "SEEN") seen++;

        if (r.pipeline.state === "DISCHARGE_ELIGIBLE" || r.pipeline.isEligibleForDischarge) {
          dischargeEligible++;
        }

        if (r.patient.todayTemp && r.patient.todayTemp >= 38.0) {
          feverToday++;
        }

        if (r.pipeline.isOverdueTemp || r.pipeline.isOverdueDoctor) {
          overdue++;
        }
      }
    });

    const percentMeasured = occupied > 0 ? Math.round(((occupied - needsTemp) / occupied) * 100) : 0;
    const percentSeen = occupied > 0 ? Math.round((seen / occupied) * 100) : 0;

    return {
      total,
      occupied,
      free,
      cleaning,
      needsTemp,
      readyForDoctor,
      seen,
      dischargeEligible,
      feverToday,
      overdue,
      percentMeasured,
      percentSeen,
    };
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (filterSection !== "ALL" && r.room.section !== filterSection) return false;

      if (filterPipeline !== "ALL") {
        if (filterPipeline === "FREE" && r.room.status !== "FREE") return false;
        if (filterPipeline === "CLEANING" && r.room.status !== "CLEANING") return false;
        if (filterPipeline === "NEEDS_TEMP" && r.pipeline?.state !== "NEEDS_TEMP") return false;
        if (filterPipeline === "READY_FOR_DOCTOR" && r.pipeline?.state !== "READY_FOR_DOCTOR") return false;
        if (filterPipeline === "SEEN" && r.pipeline?.state !== "SEEN") return false;
        if (filterPipeline === "DISCHARGE_ELIGIBLE" && !r.pipeline?.isEligibleForDischarge) return false;
        if (filterPipeline === "OVERDUE" && !r.pipeline?.isOverdueTemp && !r.pipeline?.isOverdueDoctor) return false;
        if (filterPipeline === "FEVER" && (!r.patient?.todayTemp || r.patient.todayTemp < 38.0)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoom = r.room.roomNumber.toLowerCase().includes(q);
        const matchesPatient = r.patient?.name.toLowerCase().includes(q);
        if (!matchesRoom && !matchesPatient) return false;
      }

      return true;
    });
  }, [rooms, filterSection, filterPipeline, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Facility Live Ward Board
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time occupancy, pipeline progression, and zero-paperwork clinical tracking for 74 beds.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/patients?action=register"
            className="btn-touch px-4 py-2 rounded-xl bg-sky-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-sky-700 flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admit Patient</span>
          </Link>

          <Link
            href="/discharge"
            className="btn-touch px-4 py-2 rounded-xl bg-purple-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-purple-700 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Discharge Center ({kpis.dischargeEligible})</span>
          </Link>
        </div>
      </div>

      {/* Statistical Quality Alert Banner (Wilson 95% CI) */}
      {qualityStatus && qualityStatus.status !== "GREEN" && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
            qualityStatus.status === "RED"
              ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
              : "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
          }`}
        >
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-sm block">
              Statistical Quality Alert: {qualityStatus.status} Status
            </span>
            <p className="mt-0.5 leading-relaxed">{qualityStatus.statusExplanation}</p>
          </div>
          <Link
            href="/discharge"
            className="px-3 py-1.5 rounded-lg bg-white/80 hover:bg-white text-xs font-bold shadow-xs shrink-0 self-center"
          >
            Review Analytics
          </Link>
        </div>
      )}

      {/* KPI Stat Cards (8 Live Counters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Total Occupancy */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Occupancy</span>
            <Users className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            {kpis.occupied}<span className="text-xs text-slate-400 font-medium">/{kpis.total}</span>
          </div>
          <span className="text-[10px] text-slate-500">{kpis.free} Free • {kpis.cleaning} Cleaning</span>
        </div>

        {/* Needs Temp */}
        <div
          onClick={() => setFilterPipeline("NEEDS_TEMP")}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Needs Temp</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-amber-600">{kpis.needsTemp}</div>
          <span className="text-[10px] text-slate-500">Morning round</span>
        </div>

        {/* Ready for Doctor */}
        <div
          onClick={() => setFilterPipeline("READY_FOR_DOCTOR")}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:border-sky-400 transition-colors"
        >
          <div className="flex items-center justify-between text-sky-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ready for Doc</span>
            <Stethoscope className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-sky-600">{kpis.readyForDoctor}</div>
          <span className="text-[10px] text-slate-500">Temp recorded</span>
        </div>

        {/* Doctor Seen */}
        <div
          onClick={() => setFilterPipeline("SEEN")}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Seen Today</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600">{kpis.seen}</div>
          <span className="text-[10px] text-slate-500">Round completed</span>
        </div>

        {/* Discharge Eligible */}
        <div
          onClick={() => setFilterPipeline("DISCHARGE_ELIGIBLE")}
          className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-xs cursor-pointer hover:border-purple-400 transition-colors"
        >
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ready Cured</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-purple-700 dark:text-purple-300">{kpis.dischargeEligible}</div>
          <span className="text-[10px] text-purple-600 font-semibold">3-day streak</span>
        </div>

        {/* Fever Today */}
        <div
          onClick={() => setFilterPipeline("FEVER")}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:border-red-400 transition-colors"
        >
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Fever Today</span>
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-red-600">{kpis.feverToday}</div>
          <span className="text-[10px] text-slate-500">≥ 38.0°C</span>
        </div>

        {/* Overdue */}
        <div
          onClick={() => setFilterPipeline("OVERDUE")}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:border-red-400 transition-colors"
        >
          <div className="flex items-center justify-between text-red-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-red-500">{kpis.overdue}</div>
          <span className="text-[10px] text-slate-500">Past cutoffs</span>
        </div>

        {/* Waitlist */}
        <Link
          href="/patients?tab=waitlist"
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-sky-400 transition-colors block"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Waitlist</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{waitlistCount}</div>
          <span className="text-[10px] text-slate-500">Queue pending</span>
        </Link>
      </div>

      {/* Today's Facility Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-emerald-600" />
              <span>Today's Temperature Measurements</span>
            </span>
            <span>{kpis.percentMeasured}% ({kpis.occupied - kpis.needsTemp}/{kpis.occupied})</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${kpis.percentMeasured}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-sky-600" />
              <span>Today's Physician Rounds Completed</span>
            </span>
            <span>{kpis.percentSeen}% ({kpis.seen}/{kpis.occupied})</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              style={{ width: `${kpis.percentSeen}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ward Board Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        {/* Section Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Section:</span>
          {["ALL", "A", "B", "C", "D", "E"].map((sec) => (
            <button
              key={sec}
              onClick={() => setFilterSection(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                filterSection === sec
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {sec === "ALL" ? "All Wings" : `Wing ${sec}`}
            </button>
          ))}
        </div>

        {/* Pipeline Filter & Search */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={filterPipeline}
            onChange={(e) => setFilterPipeline(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All States (74 Beds)</option>
            <option value="NEEDS_TEMP">Needs Temp</option>
            <option value="READY_FOR_DOCTOR">Ready for Doctor</option>
            <option value="SEEN">Seen Today</option>
            <option value="DISCHARGE_ELIGIBLE">Discharge Ready (Streak 3)</option>
            <option value="FEVER">Fever Today (≥ 38.0°C)</option>
            <option value="OVERDUE">Overdue Cutoff</option>
            <option value="FREE">Free Rooms</option>
            <option value="CLEANING">Cleaning in Progress</option>
          </select>

          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search room or patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-xs"
            />
          </div>

          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg ${viewMode === "grid" ? "bg-white dark:bg-slate-800 shadow-xs" : "text-slate-400"}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg ${viewMode === "list" ? "bg-white dark:bg-slate-800 shadow-xs" : "text-slate-400"}`}
              title="Compact List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Ward Board Floor-Plan Grid of 74 Rooms */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-500">No rooms match your filter criteria.</p>
          <button
            onClick={() => {
              setFilterSection("ALL");
              setFilterPipeline("ALL");
              setSearchQuery("");
            }}
            className="mt-2 text-xs font-bold text-sky-600 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
          {filteredRooms.map(({ room, patient, pipeline }) => {
            // Unoccupied / Cleaning / Free room tile
            if (!patient || room.status !== "OCCUPIED") {
              const isCleaning = room.status === "CLEANING";
              return (
                <div
                  key={room.id}
                  className={`p-3 rounded-2xl border-2 border-dashed flex flex-col justify-between min-h-[140px] transition-all ${
                    isCleaning
                      ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20"
                      : "border-slate-300 bg-slate-50/60 hover:border-sky-400 hover:bg-sky-50/30 dark:bg-slate-800/40 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{room.roomNumber}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCleaning
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>

                  <div className="my-auto text-center py-2">
                    <p className="text-xs text-slate-400 font-medium">
                      {isCleaning ? "Sanitizing..." : "Bed Available"}
                    </p>
                  </div>

                  {isCleaning ? (
                    <button
                      onClick={async () => {
                        await fetch("/api/discharge/cleaning-done", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ roomId: room.id }),
                        });
                        setRooms((prev) =>
                          prev.map((r) => (r.room.id === room.id ? { ...r, room: { ...r.room, status: "FREE" } } : r))
                        );
                      }}
                      className="w-full py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shadow-xs transition-colors"
                    >
                      Mark Cleaned
                    </button>
                  ) : (
                    <Link
                      href={`/patients?action=register&roomId=${room.id}`}
                      className="w-full py-1 text-center rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold shadow-xs transition-colors"
                    >
                      Admit Here
                    </Link>
                  )}
                </div>
              );
            }

            // Occupied Patient Tile
            const isFever = patient.todayTemp && patient.todayTemp >= 38.0;
            const isDischargeEligible = pipeline?.isEligibleForDischarge || patient.status === "DISCHARGE_ELIGIBLE";

            return (
              <Link
                key={room.id}
                href={`/patients/${patient.id}`}
                className={`group p-3 rounded-2xl border-2 shadow-xs hover:shadow-md hover:scale-[1.02] flex flex-col justify-between min-h-[148px] transition-all relative overflow-hidden bg-white dark:bg-slate-800 ${
                  isDischargeEligible
                    ? "border-purple-500 bg-purple-50/20 shadow-purple-100 dark:shadow-none"
                    : isFever
                    ? "border-red-400 bg-red-50/20"
                    : pipeline?.state === "SEEN"
                    ? "border-emerald-300"
                    : pipeline?.state === "READY_FOR_DOCTOR"
                    ? "border-sky-300"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                {/* Header: Room Number & Pipeline Badge */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-sky-600 transition-colors">
                    {room.roomNumber}
                  </span>
                  {pipeline && (
                    <PipelineBadge
                      state={pipeline.state}
                      isOverdueTemp={pipeline.isOverdueTemp}
                      isOverdueDoctor={pipeline.isOverdueDoctor}
                      size="sm"
                    />
                  )}
                </div>

                {/* Patient Name & Details */}
                <div className="my-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={patient.name}>
                    {patient.name}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span>{patient.age}y {patient.sex[0]}</span>
                    <span>•</span>
                    <span className="font-semibold">{patient.severity}</span>
                  </div>
                </div>

                {/* Temperature Reading & Trend */}
                <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-750 border border-slate-100 dark:border-slate-700/60 my-1">
                  <span className="text-[10px] text-slate-400">Temp:</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs font-mono font-bold ${
                        isFever ? "text-red-600" : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {patient.todayTemp ? formatTemp(patient.todayTemp) : "Pending"}
                    </span>
                    {patient.todayTemp && isFever && <TrendingUp className="w-3 h-3 text-red-500" />}
                    {patient.todayTemp && !isFever && <TrendingDown className="w-3 h-3 text-emerald-500" />}
                  </div>
                </div>

                {/* 3-Dot Streak Visualizer */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700/80">
                  <StreakDots streak={pipeline?.streak || 0} requiredDays={3} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Compact List View for High Density Monitoring */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Status / Pipeline</th>
                  <th className="py-3 px-4">Today Temp</th>
                  <th className="py-3 px-4">Doctor Visit</th>
                  <th className="py-3 px-4">Streak (3d Goal)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredRooms.map(({ room, patient, pipeline }) => {
                  if (!patient || room.status !== "OCCUPIED") {
                    return (
                      <tr key={room.id} className="bg-slate-50/40 dark:bg-slate-800/20">
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">{room.roomNumber}</td>
                        <td className="py-3 px-4 text-slate-400 italic">No patient assigned</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700">
                            {room.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">—</td>
                        <td className="py-3 px-4 text-slate-400">—</td>
                        <td className="py-3 px-4 text-slate-400">—</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/patients?action=register&roomId=${room.id}`}
                            className="text-xs font-bold text-sky-600 hover:underline"
                          >
                            Admit
                          </Link>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={room.id}
                      onClick={() => router.push(`/patients/${patient.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{room.roomNumber}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{patient.name}</span>
                        <span className="text-[10px] text-slate-500">{patient.age}y {patient.sex}</span>
                      </td>
                      <td className="py-3 px-4">
                        {pipeline && (
                          <PipelineBadge
                            state={pipeline.state}
                            isOverdueTemp={pipeline.isOverdueTemp}
                            isOverdueDoctor={pipeline.isOverdueDoctor}
                            size="sm"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {patient.todayTemp ? (
                          <span className={patient.todayTemp >= 38.0 ? "text-red-600" : "text-emerald-600"}>
                            {formatTemp(patient.todayTemp)}
                          </span>
                        ) : (
                          <span className="text-amber-600">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {patient.todayVisit ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Seen
                          </span>
                        ) : (
                          <span className="text-slate-400">Not visited</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StreakDots streak={pipeline?.streak || 0} requiredDays={3} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="text-sky-600 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

