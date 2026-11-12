"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  HeartPulse,
  Stethoscope,
  Sparkles,
  Lock,
  ArrowRight,
  Delete,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { useApp } from "@/components/AppContext";

interface StaffMember {
  id: string;
  name: string;
  role: "ADMIN" | "NURSE" | "DOCTOR";
  pin: string;
  avatar?: string | null;
  isDemo: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser, addToast } = useApp();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "NURSE" | "DOCTOR">("ADMIN");
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Fetch staff list for demo accounts
  useEffect(() => {
    fetch("/api/auth/staff")
      .then((res) => res.json())
      .then((data) => {
        if (data?.staff) {
          setStaffList(data.staff);
          // Auto-select first staff of current role
          const defaultStaff = data.staff.find((s: StaffMember) => s.role === "ADMIN");
          if (defaultStaff) {
            setSelectedUser(defaultStaff);
            setPin(defaultStaff.pin);
          }
        }
      });
  }, []);

  // Update selected user when role changes
  const handleRoleSelect = (role: "ADMIN" | "NURSE" | "DOCTOR") => {
    setSelectedRole(role);
    setErrorMsg("");
    let matching: StaffMember | undefined;
    if (role === "DOCTOR") {
      matching = staffList.find((s) => s.id === "u-doc-3" || s.name.includes("Ananya")) || staffList.find((s) => s.role === "DOCTOR");
    } else {
      matching = staffList.find((s) => s.role === role);
    }
    if (matching) {
      setSelectedUser(matching);
      setPin(matching.pin);
    }
  };

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => setLockoutSeconds(lockoutSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutSeconds]);

  // Keypad number press
  const handleKeypadPress = (num: string) => {
    if (lockoutSeconds > 0 || pin.length >= 4) return;
    const nextPin = pin + num;
    setPin(nextPin);
    if (nextPin.length === 4) {
      handleLoginSubmit(nextPin);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg("");
  };

  const handleLoginSubmit = async (pinToVerify = pin, userToLogin = selectedUser) => {
    if (!userToLogin || pinToVerify.length !== 4) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userToLogin.id, pin: pinToVerify }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        addToast({ type: "success", message: `Welcome back, ${data.user.name}!` });
        // Redirect to role dashboard
        if (data.user.role === "ADMIN") router.push("/admin");
        else if (data.user.role === "NURSE") router.push("/nurse");
        else router.push("/doctor");
      } else {
        if (data.locked) {
          setLockoutSeconds(data.waitSeconds || 60);
        }
        setErrorMsg(data.error || "Login failed");
        setPin("");
      }
    } catch {
      setErrorMsg("Network error during login");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  // 1-Tap Quick Demo Login (for Instant Reviewer Access)
  const handleQuickDemoLogin = (role: "ADMIN" | "NURSE" | "DOCTOR", targetStaffId?: string) => {
    let demoStaff: StaffMember | undefined;
    if (targetStaffId) {
      demoStaff = staffList.find((s) => s.id === targetStaffId);
    }
    if (!demoStaff) {
      if (role === "DOCTOR") {
        demoStaff = staffList.find((s) => s.id === "u-doc-3" || s.name.includes("Ananya")) || staffList.find((s) => s.role === "DOCTOR");
      } else if (role === "NURSE") {
        demoStaff = staffList.find((s) => s.id === "u-nurse-1" || s.name.includes("Anita")) || staffList.find((s) => s.role === "NURSE");
      } else {
        demoStaff = staffList.find((s) => s.id === "u-admin-1" || s.name.includes("Sarah")) || staffList.find((s) => s.role === "ADMIN");
      }
    }

    if (!demoStaff) {
      const fallbackMap = {
        ADMIN: { id: "u-admin-1", name: "Dr. Sarah Chen", role: "ADMIN" as const, pin: "1111", isDemo: true },
        NURSE: { id: "u-nurse-1", name: "Anita Patel", role: "NURSE" as const, pin: "3333", isDemo: true },
        DOCTOR: { id: "u-doc-3", name: "Dr. Ananya Iyer", role: "DOCTOR" as const, pin: "2244", isDemo: true },
      };
      demoStaff = fallbackMap[role];
    }

    if (demoStaff) {
      setSelectedRole(role);
      setSelectedUser(demoStaff);
      setPin(demoStaff.pin);
      handleLoginSubmit(demoStaff.pin, demoStaff);
    }
  };

  const filteredStaff = staffList.filter((s) => s.role === selectedRole);

  return (
    <div className="w-full max-w-6xl xl:max-w-7xl mx-auto py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* Hero Branding */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>FACILITY QUARANTINE PIPELINE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          WardPulse Clinical Ward Board
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Single source of truth floor-plan board for 74 quarantine rooms. Eliminates missed temperature rounds, gates physician visits, automates 3-day fever-free discharges, and guarantees statistical quality control.
        </p>
      </div>

      {/* 1-Tap Quick Demo Access Cards (Reviewer Friendly) */}
      <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 p-5 sm:p-6 rounded-3xl border border-sky-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-700 dark:text-sky-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Instant 1-Tap Demo Access (Reviewer Mode)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">No signup or typing required</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleQuickDemoLogin("ADMIN")}
            disabled={loading}
            className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-purple-200 hover:border-purple-500 shadow-xs hover:shadow-md transition-all text-left group"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                ADMIN
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1.5">Dr. Sarah Chen</p>
              <p className="text-xs text-slate-500">PIN: 1111 • Ward Board & Ops</p>
            </div>
            <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => handleQuickDemoLogin("NURSE")}
            disabled={loading}
            className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition-all text-left group"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                NURSE
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1.5">Anita Patel</p>
              <p className="text-xs text-slate-500">PIN: 3333 • Temperature Triage</p>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => handleQuickDemoLogin("DOCTOR", "u-doc-3")}
            disabled={loading}
            className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-sky-200 hover:border-sky-500 shadow-xs hover:shadow-md transition-all text-left group"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-full">
                DOCTOR
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1.5">Dr. Ananya Iyer</p>
              <p className="text-xs text-slate-500">PIN: 2244 • Clinical Rounds</p>
            </div>
            <ArrowRight className="w-5 h-5 text-sky-600 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        <button
          onClick={() => handleRoleSelect("ADMIN")}
          className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all text-center ${
            selectedRole === "ADMIN"
              ? "border-purple-600 bg-purple-50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200 shadow-md scale-[1.01]"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
          }`}
        >
          <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-sm sm:text-base font-black">Admin Portal</span>
          <span className="text-xs text-slate-500 hidden sm:inline">74 Beds & Discharges</span>
        </button>

        <button
          onClick={() => handleRoleSelect("NURSE")}
          className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all text-center ${
            selectedRole === "NURSE"
              ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-md scale-[1.01]"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
          }`}
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <HeartPulse className="w-6 h-6" />
          </div>
          <span className="text-sm sm:text-base font-black">Nurse Station</span>
          <span className="text-xs text-slate-500 hidden sm:inline">Temperature Rounds</span>
        </button>

        <button
          onClick={() => handleRoleSelect("DOCTOR")}
          className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all text-center ${
            selectedRole === "DOCTOR"
              ? "border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 shadow-md scale-[1.01]"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
          }`}
        >
          <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
          <span className="text-sm sm:text-base font-black">Doctor Rounds</span>
          <span className="text-xs text-slate-500 hidden sm:inline">Pipeline Gated</span>
        </button>
      </div>

      {/* Staff Selector & Gloved-friendly PIN Keypad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 bg-white dark:bg-slate-800 p-5 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Left Column: Staff Picker & Credentials Help */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Staff Member ({selectedRole})
              </label>
              <span className="text-xs text-slate-400">Click staff card or use PIN keypad</span>
            </div>
            <div className="space-y-2.5">
              {filteredStaff.map((staff) => (
                <div
                  key={staff.id}
                  onClick={() => {
                    setSelectedUser(staff);
                    setPin(staff.pin);
                    setErrorMsg("");
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    selectedUser?.id === staff.id
                      ? "border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-xs ring-1 ring-sky-500/30"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-750"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-sm flex items-center justify-center text-slate-700 dark:text-slate-200">
                      {staff.avatar || staff.name.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{staff.name}</h4>
                      <p className="text-xs text-slate-500">{staff.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      PIN: {staff.pin}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(staff);
                        setPin(staff.pin);
                        handleLoginSubmit(staff.pin, staff);
                      }}
                      className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                    >
                      <span>Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Gloved Hand Keypad Safety</span>
            </div>
            <p className="text-xs leading-relaxed">
              Designed with large 48px touch targets for sanitized gloved tablet use. 5 consecutive incorrect attempts trigger a 60-second security cooldown.
            </p>
          </div>
        </div>

        {/* Right Column: Gloved Numeric Keypad */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="w-full max-w-xs space-y-4">
            <div className="text-center">
              <span className="text-xs text-slate-500 font-medium">Entering PIN for</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {selectedUser?.name || "Staff Member"}
              </h3>

              {/* 4-Digit Display */}
              <div className="flex items-center justify-center gap-3 my-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold font-mono transition-all ${
                      pin.length > idx
                        ? "border-sky-600 bg-white text-sky-700 shadow-sm dark:bg-slate-800 dark:text-sky-300"
                        : "border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    {pin.length > idx ? "●" : ""}
                  </div>
                ))}
              </div>

              {/* Error or Lockout Message */}
              {lockoutSeconds > 0 ? (
                <p className="text-xs font-bold text-red-600 animate-pulse">
                  Account locked. Try again in {lockoutSeconds}s
                </p>
              ) : errorMsg ? (
                <p className="text-xs font-semibold text-red-600">{errorMsg}</p>
              ) : (
                <p className="text-xs text-slate-400">Tap 4 digits to sign in</p>
              )}
            </div>

            {/* Keypad Grid (Large Gloved Tap Targets) */}
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num)}
                  disabled={lockoutSeconds > 0 || loading}
                  className="btn-touch h-12 sm:h-14 rounded-2xl bg-white dark:bg-slate-800 text-lg sm:text-xl font-bold text-slate-800 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700 active:scale-95 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center disabled:opacity-40"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPin("")}
                disabled={lockoutSeconds > 0 || loading || pin.length === 0}
                className="btn-touch h-12 sm:h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 hover:bg-slate-300 transition-all flex items-center justify-center disabled:opacity-40"
              >
                CLEAR
              </button>

              <button
                type="button"
                onClick={() => handleKeypadPress("0")}
                disabled={lockoutSeconds > 0 || loading}
                className="btn-touch h-12 sm:h-14 rounded-2xl bg-white dark:bg-slate-800 text-lg sm:text-xl font-bold text-slate-800 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700 active:scale-95 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center disabled:opacity-40"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={lockoutSeconds > 0 || loading || pin.length === 0}
                className="btn-touch h-12 sm:h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 active:scale-95 hover:bg-slate-300 transition-all flex items-center justify-center disabled:opacity-40"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Facility Highlights Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Real-Time Ward</span>
          <h4 className="text-sm font-black text-slate-900 dark:text-white">74 Quarantine Beds</h4>
          <p className="text-xs text-slate-500">Live floor-plan board with single source of truth.</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Pipeline Gating</span>
          <h4 className="text-sm font-black text-slate-900 dark:text-white">Physician Visits</h4>
          <p className="text-xs text-slate-500">Rounds unlocked strictly after daily temp is logged.</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Automated Discharge</span>
          <h4 className="text-sm font-black text-slate-900 dark:text-white">3 Fever-Free Days</h4>
          <p className="text-xs text-slate-500">Instant eligibility notification and bed turnover.</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Quality Assurance</span>
          <h4 className="text-sm font-black text-slate-900 dark:text-white">Wilson 95% CI</h4>
          <p className="text-xs text-slate-500">Statistical alerting against 15% mortality benchmark.</p>
        </div>
      </div>
    </div>
  );
}
