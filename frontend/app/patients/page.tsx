"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ArrowUpDown,
  Clock,
  Sparkles,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Bed,
  ArrowRight,
  ChevronDown,
  X,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useApp } from "@/components/AppContext";
import { StreakDots } from "@/components/StreakDots";
import { PipelineBadge } from "@/components/PipelineBadge";
import { TableListSkeleton } from "@/components/Skeleton";
import { formatTemp } from "@/lib/utils";

interface PatientItem {
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
  roomId: number | null;
  roomNumber?: string;
  latestTemp: number | null;
  todayTemp: number | null;
  todayVisit: boolean;
  pipeline?: any;
}

interface WaitlistEntry {
  id: string;
  patientName: string;
  age: number;
  sex: string;
  emergencyContact: string;
  contactPhone: string;
  symptoms?: string | null;
  severity: string;
  priority: number;
  addedAt: string;
  status: string;
}

function PatientListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, addToast, refreshTrigger, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState<"patients" | "waitlist">("patients");
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [freeRooms, setFreeRooms] = useState<Array<{ id: number; roomNumber: string; section: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [feverOnly, setFeverOnly] = useState(false);

  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerAge, setRegisterAge] = useState("");
  const [registerSex, setRegisterSex] = useState("Male");
  const [registerEmergencyContact, setRegisterEmergencyContact] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerSymptoms, setRegisterSymptoms] = useState("");
  const [registerSeverity, setRegisterSeverity] = useState("MODERATE");
  const [registerRoomId, setRegisterRoomId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Check query param for immediate registration trigger
  useEffect(() => {
    if (searchParams.get("action") === "register") {
      setShowRegisterModal(true);
      const preselectedRoom = searchParams.get("roomId");
      if (preselectedRoom) setRegisterRoomId(preselectedRoom);
    }
    if (searchParams.get("tab") === "waitlist") {
      setActiveTab("waitlist");
    }
  }, [searchParams]);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/patients").then((r) => r.json()),
      fetch("/api/waitlist").then((r) => r.json()),
    ])
      .then(([patientsData, waitlistData]) => {
        if (patientsData?.rooms) {
          const patientList: PatientItem[] = [];
          const free: Array<{ id: number; roomNumber: string; section: string }> = [];

          patientsData.rooms.forEach((r: any) => {
            if (r.patient) {
              patientList.push({
                ...r.patient,
                pipeline: r.pipeline,
              });
            } else if (r.room.status === "FREE") {
              free.push(r.room);
            }
          });

          setPatients(patientList);
          setFreeRooms(free);
          if (free.length > 0 && !registerRoomId) {
            setRegisterRoomId(String(free[0].id));
          }
        }

        if (waitlistData?.waitlist) {
          setWaitlist(waitlistData.waitlist);
        }
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "DISCHARGE_ELIGIBLE" && !p.pipeline?.isEligibleForDischarge) return false;
        if (statusFilter === "NEEDS_TEMP" && p.pipeline?.state !== "NEEDS_TEMP") return false;
        if (statusFilter === "SEEN" && p.pipeline?.state !== "SEEN") return false;
        if (statusFilter === "UNDER_TREATMENT" && p.status !== "UNDER_TREATMENT") return false;
      }

      if (sectionFilter !== "ALL" && p.roomNumber && !p.roomNumber.startsWith(sectionFilter)) {
        return false;
      }

      if (feverOnly && (!p.todayTemp || p.todayTemp < 38.0)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesRoom = p.roomNumber?.toLowerCase().includes(q);
        const matchesContact = p.emergencyContact.toLowerCase().includes(q);
        if (!matchesName && !matchesRoom && !matchesContact) return false;
      }

      return true;
    });
  }, [patients, statusFilter, sectionFilter, feverOnly, searchQuery]);

  // Handle Admission Submit
  const handleRegisterPatient = async (ignoreWarning = false) => {
    if (!registerName || !registerAge || !registerEmergencyContact || !registerRoomId) {
      addToast({ type: "error", message: "Please fill in all mandatory patient fields." });
      return;
    }

    setRegistering(true);
    setDuplicateWarning(null);

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName,
          age: parseInt(registerAge, 10),
          sex: registerSex,
          emergencyContact: registerEmergencyContact,
          contactPhone: registerPhone || registerEmergencyContact,
          symptoms: registerSymptoms,
          severity: registerSeverity,
          roomId: registerRoomId,
          ignoreDuplicateWarning: ignoreWarning,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", message: `Patient ${registerName} successfully admitted!` });
        setShowRegisterModal(false);
        triggerRefresh();
        // Reset form
        setRegisterName("");
        setRegisterAge("");
        setRegisterEmergencyContact("");
        setRegisterPhone("");
        setRegisterSymptoms("");
      } else if (res.status === 409 && data.isDuplicateWarning) {
        setDuplicateWarning(data.warning);
      } else {
        addToast({ type: "error", message: data.error || "Admission failed" });
      }
    } catch {
      addToast({ type: "error", message: "Network error during registration" });
    } finally {
      setRegistering(false);
    }
  };

  // Add to Waitlist Action (when facility is full or requested)
  const handleAddToWaitlist = async () => {
    if (!registerName || !registerAge || !registerEmergencyContact) {
      addToast({ type: "error", message: "Please enter patient name, age, and contact." });
      return;
    }

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: registerName,
          age: parseInt(registerAge, 10),
          sex: registerSex,
          emergencyContact: registerEmergencyContact,
          contactPhone: registerPhone || registerEmergencyContact,
          symptoms: registerSymptoms,
          severity: registerSeverity,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", message: `${registerName} added to waitlist queue!` });
        setShowRegisterModal(false);
        setActiveTab("waitlist");
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Failed to add to waitlist" });
      }
    } catch {
      addToast({ type: "error", message: "Network error adding to waitlist" });
    }
  };

  // Admit from waitlist
  const handleAdmitWaitlistEntry = async (entryId: string, targetRoomId: number) => {
    try {
      const res = await fetch("/api/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADMIT",
          entryId,
          targetRoomId,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", message: "Waitlisted patient admitted successfully!" });
        triggerRefresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Admission failed" });
      }
    } catch {
      addToast({ type: "error", message: "Error admitting from waitlist" });
    }
  };

  const isFacilityFull = freeRooms.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Patient Management & Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Active cohort, room allocations, waitlist triage, and clinical status lifecycle.
          </p>
        </div>

        {user?.role === "ADMIN" && (
          <button
            onClick={() => setShowRegisterModal(true)}
            className="btn-touch px-4 py-2 rounded-xl bg-sky-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-sky-700 flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Patient</span>
          </button>
        )}
      </div>

      {/* Main Tabs: Active Patients vs Waitlist */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("patients")}
          className={`pb-3 px-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "patients"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Inpatients ({patients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("waitlist")}
          className={`pb-3 px-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "waitlist"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Waitlist Queue ({waitlist.length})</span>
        </button>
      </div>

      {activeTab === "patients" ? (
        <>
          {/* Toolbar & Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search patient name, room, contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-xs"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Clinical Statuses</option>
                <option value="NEEDS_TEMP">Needs Temp Today</option>
                <option value="SEEN">Seen by Doctor</option>
                <option value="DISCHARGE_ELIGIBLE">Discharge Ready (Streak ≥ 3)</option>
                <option value="UNDER_TREATMENT">Under Treatment</option>
              </select>

              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Wings</option>
                <option value="A">Wing A</option>
                <option value="B">Wing B</option>
                <option value="C">Wing C</option>
                <option value="D">Wing D</option>
                <option value="E">Wing E</option>
              </select>
            </div>

            <button
              onClick={() => setFeverOnly(!feverOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                feverOnly
                  ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-700"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-red-500" />
              <span>Fever Today (≥ 38.0°C)</span>
            </button>
          </div>

          {/* Desktop Table / Mobile Stacked Cards */}
          {loading ? (
            <TableListSkeleton rows={8} />
          ) : filteredPatients.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-500">No patients match the selected filters.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Room</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Age / Sex</th>
                      <th className="py-3 px-4">Admission</th>
                      <th className="py-3 px-4">Pipeline Status</th>
                      <th className="py-3 px-4">Latest Temp</th>
                      <th className="py-3 px-4">Fever-Free Streak</th>
                      <th className="py-3 px-4">Emergency Contact</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredPatients.map((p) => {
                      const isFever = p.todayTemp && p.todayTemp >= 38.0;
                      const dayOfStay = Math.max(
                        1,
                        Math.ceil((Date.now() - new Date(p.admittedAt).getTime()) / (1000 * 60 * 60 * 24))
                      );

                      return (
                        <tr
                          key={p.id}
                          onClick={() => router.push(`/patients/${p.id}`)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                              {p.roomNumber || "N/A"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">{p.severity}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                            {p.age}y • {p.sex}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            <span>Day {dayOfStay}</span>
                            <span className="text-[10px] block text-slate-400">
                              {new Date(p.admittedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {p.pipeline && (
                              <PipelineBadge
                                state={p.pipeline.state}
                                isOverdueTemp={p.pipeline.isOverdueTemp}
                                isOverdueDoctor={p.pipeline.isOverdueDoctor}
                                size="sm"
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {p.todayTemp ? (
                              <span className={isFever ? "text-red-600" : "text-emerald-600"}>
                                {formatTemp(p.todayTemp)}
                              </span>
                            ) : (
                              <span className="text-amber-600">Pending</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <StreakDots streak={p.pipeline?.streak || 0} requiredDays={3} />
                          </td>
                          <td className="py-3 px-4 text-slate-500 truncate max-w-[140px]" title={p.emergencyContact}>
                            {user?.role === "NURSE" ? "Spouse (Masked)" : p.emergencyContact}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/patients/${p.id}`}
                              className="text-sky-600 font-bold hover:underline"
                            >
                              Open →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards View */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                {filteredPatients.map((p) => {
                  const isFever = p.todayTemp && p.todayTemp >= 38.0;
                  const dayOfStay = Math.max(
                    1,
                    Math.ceil((Date.now() - new Date(p.admittedAt).getTime()) / (1000 * 60 * 60 * 24))
                  );

                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/patients/${p.id}`)}
                      className="p-4 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-black text-xs bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                            {p.roomNumber || "N/A"}
                          </span>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</h3>
                        </div>
                        {p.pipeline && (
                          <PipelineBadge
                            state={p.pipeline.state}
                            isOverdueTemp={p.pipeline.isOverdueTemp}
                            isOverdueDoctor={p.pipeline.isOverdueDoctor}
                            size="sm"
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{p.age}y {p.sex} • Day {dayOfStay}</span>
                        <div className="flex items-center gap-1 font-mono font-bold">
                          <span>Temp:</span>
                          <span className={isFever ? "text-red-600" : "text-emerald-600"}>
                            {p.todayTemp ? formatTemp(p.todayTemp) : "Pending"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <StreakDots streak={p.pipeline?.streak || 0} requiredDays={3} />
                        <span className="text-xs font-bold text-sky-600">Details →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Waitlist Tab */
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Waitlist Admission Queue</h3>
              <p className="text-xs text-slate-500">
                Sorted by clinical triage priority. Patients can be admitted directly once a room becomes FREE.
              </p>
            </div>
            {freeRooms.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                {freeRooms.length} Beds Currently Free!
              </span>
            )}
          </div>

          {waitlist.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-500">Waitlist is currently empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {waitlist.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 text-xs font-black flex items-center justify-center">
                          #{entry.priority}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{entry.patientName}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {entry.age}y • {entry.sex} • Severity: <span className="font-semibold">{entry.severity}</span>
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-400">
                      Added {new Date(entry.addedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-medium">Symptoms: {entry.symptoms || "Prolonged high fever"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Contact: {entry.emergencyContact}</p>
                  </div>

                  {user?.role === "ADMIN" && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                      {freeRooms.length > 0 ? (
                        <div className="flex items-center gap-2 w-full">
                          <select
                            id={`room-select-${entry.id}`}
                            className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-semibold flex-1"
                            defaultValue={freeRooms[0].id}
                          >
                            {freeRooms.map((fr) => (
                              <option key={fr.id} value={fr.id}>
                                Room {fr.roomNumber} (Wing {fr.section})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`room-select-${entry.id}`) as HTMLSelectElement;
                              handleAdmitWaitlistEntry(entry.id, parseInt(sel.value, 10));
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs whitespace-nowrap"
                          >
                            Admit Patient
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-semibold">No free rooms. Release a room to admit.</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patient Registration Modal with 74-Capacity Guard & Free Room Visual Picker */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Admit New Quarantine Patient</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 74/74 Facility Full Capacity Banner */}
            {isFacilityFull ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Facility Full (74 / 74 Beds Occupied)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    All rooms are currently in use or cleaning. Direct admission is restricted until a patient is discharged. You can queue this patient into the Priority Waitlist.
                  </p>
                </div>

                <div className="space-y-3 text-left p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Patient Full Name
                    </label>
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="e.g. Rahul Sen"
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Age</label>
                      <input
                        type="number"
                        value={registerAge}
                        onChange={(e) => setRegisterAge(e.target.value)}
                        placeholder="35"
                        className="w-full px-3 py-2 rounded-xl border text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sex</label>
                      <select
                        value={registerSex}
                        onChange={(e) => setRegisterSex(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-xs"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Emergency Contact & Phone
                    </label>
                    <input
                      type="text"
                      value={registerEmergencyContact}
                      onChange={(e) => setRegisterEmergencyContact(e.target.value)}
                      placeholder="e.g. Brother (+91 9876543210)"
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 rounded-xl border text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToWaitlist}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow"
                  >
                    Add to Priority Waitlist
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegisterPatient(false);
                }}
                className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
              >
                {/* Duplicate Warning Prompt */}
                {duplicateWarning && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Duplicate Patient Warning</span>
                    </p>
                    <p>{duplicateWarning}</p>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleRegisterPatient(true)}
                        className="px-3 py-1 rounded bg-amber-600 text-white font-bold text-[11px]"
                      >
                        Confirm & Admit Anyway
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Age *</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={registerAge}
                      onChange={(e) => setRegisterAge(e.target.value)}
                      placeholder="42"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sex *</label>
                    <select
                      value={registerSex}
                      onChange={(e) => setRegisterSex(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Emergency Contact Name & Relationship *
                  </label>
                  <input
                    type="text"
                    value={registerEmergencyContact}
                    onChange={(e) => setRegisterEmergencyContact(e.target.value)}
                    placeholder="e.g. Sunita Patel (Wife)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                  />
                </div>

                {/* Visual Free Room Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assign Room (Visual Selector: {freeRooms.length} Available) *
                  </label>
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                    {freeRooms.map((room) => (
                      <button
                        type="button"
                        key={room.id}
                        onClick={() => setRegisterRoomId(String(room.id))}
                        className={`p-2 rounded-lg text-xs font-bold border text-center transition-all ${
                          registerRoomId === String(room.id)
                            ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                            : "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-sky-400"
                        }`}
                      >
                        {room.roomNumber}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500">Only currently FREE sanitized rooms are displayed</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Severity
                    </label>
                    <select
                      value={registerSeverity}
                      onChange={(e) => setRegisterSeverity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                    >
                      <option value="MILD">MILD</option>
                      <option value="MODERATE">MODERATE</option>
                      <option value="SEVERE">SEVERE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Symptoms
                    </label>
                    <input
                      type="text"
                      value={registerSymptoms}
                      onChange={(e) => setRegisterSymptoms(e.target.value)}
                      placeholder="e.g. High fever, dry cough"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 rounded-xl border text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {registering && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Admit to Room</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatientListPage() {
  return (
    <Suspense fallback={<TableListSkeleton rows={8} />}>
      <PatientListContent />
    </Suspense>
  );
}
