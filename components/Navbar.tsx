"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Sun,
  Moon,
  Contrast,
  Volume2,
  VolumeX,
  FastForward,
  RotateCcw,
  LogOut,
  Users,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { useApp } from "./AppContext";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { SettingsModal } from "./SettingsModal";

export function Navbar() {
  const {
    user,
    setUser,
    sseConnected,
    darkMode,
    toggleDarkMode,
    highContrast,
    setHighContrast,
    soundEnabled,
    setSoundEnabled,
    addToast,
    triggerRefresh,
  } = useApp();

  const router = useRouter();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
  };

  const handleSimulateDay = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      const res = await fetch("/api/demo/simulate-day", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addToast({
          type: "success",
          message: data.message || "Next day simulated! Streaks updated.",
        });
        triggerRefresh();
      } else {
        addToast({ type: "error", message: data.error || "Simulation failed" });
      }
    } catch {
      addToast({ type: "error", message: "Network error during day simulation" });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetDemo = async () => {
    if (isResetting || !confirm("Reset all demo data back to default 74 rooms and initial state?")) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", message: "Demo data reset successfully!" });
        triggerRefresh();
      } else {
        addToast({ type: "error", message: data.error || "Reset failed" });
      }
    } catch {
      addToast({ type: "error", message: "Failed to reset demo data" });
    } finally {
      setIsResetting(false);
    }
  };

  const roleColors = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
    DOCTOR: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300",
    NURSE: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur dark:bg-slate-900/95 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & Connection Indicator */}
          <div className="flex items-center gap-3">
            <Link href={user ? (user.role === "ADMIN" ? "/admin" : user.role === "DOCTOR" ? "/doctor" : "/nurse") : "/"} className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-200 dark:shadow-none group-hover:scale-105 transition-transform">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">WardPulse</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300">LIVE</span>
                </div>
                <p className="text-[11px] text-slate-500 -mt-0.5">Quarantine Ward Board</p>
              </div>
            </Link>

            {/* Live SSE status indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span className="hidden md:inline">{sseConnected ? "Live Sync" : "Connecting..."}</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          {user && (
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              {user.role === "ADMIN" && (
                <>
                  <Link
                    href="/admin"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === "/admin" ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Ward Board
                  </Link>
                  <Link
                    href="/patients"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname.startsWith("/patients") ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Patients & Waitlist
                  </Link>
                  <Link
                    href="/discharge"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname.startsWith("/discharge") ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Discharge & Analytics
                  </Link>
                  <Link
                    href="/system"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === "/system" ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    System Status
                  </Link>
                </>
              )}

              {user.role === "NURSE" && (
                <>
                  <Link
                    href="/nurse"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === "/nurse" ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Temperature Triage
                  </Link>
                  <Link
                    href="/patients"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname.startsWith("/patients") ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Patient Directory
                  </Link>
                </>
              )}

              {user.role === "DOCTOR" && (
                <>
                  <Link
                    href="/doctor"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === "/doctor" ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Clinical Rounds
                  </Link>
                  <Link
                    href="/patients"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname.startsWith("/patients") ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Patient Directory
                  </Link>
                  <Link
                    href="/discharge"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname.startsWith("/discharge") ? "bg-sky-50 text-sky-700 font-semibold dark:bg-sky-950 dark:text-sky-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Discharge Queue
                  </Link>
                </>
              )}
            </nav>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Demo Helpers: Simulate Next Day */}
            <button
              onClick={handleSimulateDay}
              disabled={isSimulating}
              title="Fast-forward calendar day to test streak progression and rollover"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300 transition-colors disabled:opacity-50"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Simulate Next Day</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              data-testid="dark-mode-toggle"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode (currently Dark)" : "Switch to dark mode (currently Light)"}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300 hover:text-sky-600 transition-colors" />
              )}
            </button>

            {/* High Contrast Mode Toggle (WCAG AA) */}
            <button
              onClick={() => setHighContrast((prev) => !prev)}
              aria-label={highContrast ? "Disable high contrast mode" : "Enable high contrast mode (WCAG AA)"}
              title={highContrast ? "High Contrast Mode Active" : "Toggle High Contrast Mode (WCAG AA)"}
              className={`p-2 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-sky-500 ${
                highContrast
                  ? "bg-black text-white ring-2 ring-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Contrast className="w-5 h-5" />
            </button>

            {/* Sound Chime Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound Alert On" : "Sound Alert Off"}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-sky-600" /> : <VolumeX className="w-5 h-5 opacity-40" />}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </button>

            {/* Admin Settings Button */}
            {user?.role === "ADMIN" && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                title="Facility Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            {/* User Profile Pill or Switch User */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{user.name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${roleColors[user.role]}`}>
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Switch User / Logout"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Switch</span>
                </button>
              </div>
            ) : (
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold shadow hover:bg-sky-700 transition-colors"
              >
                Enter App
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Notifications Slide-over Drawer */}
      <NotificationsDrawer isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Settings Modal */}
      {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />}
    </>
  );
}

