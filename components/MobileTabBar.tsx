"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, HeartPulse, Stethoscope, Sparkles, Server, LogOut } from "lucide-react";
import { useApp } from "./AppContext";

export function MobileTabBar() {
  const { user, setUser } = useApp();
  const pathname = usePathname();

  if (!user || pathname === "/") return null;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-800 safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {user.role === "ADMIN" && (
          <>
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname === "/admin" ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-5 h-5 mb-0.5" />
              <span>Ward</span>
            </Link>
            <Link
              href="/patients"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/patients") ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Patients</span>
            </Link>
            <Link
              href="/discharge"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/discharge") ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span>Discharge</span>
            </Link>
            <Link
              href="/system"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname === "/system" ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Server className="w-5 h-5 mb-0.5" />
              <span>Status</span>
            </Link>
          </>
        )}

        {user.role === "NURSE" && (
          <>
            <Link
              href="/nurse"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname === "/nurse" ? "text-emerald-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <HeartPulse className="w-5 h-5 mb-0.5" />
              <span>To Measure</span>
            </Link>
            <Link
              href="/patients"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/patients") ? "text-emerald-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Patients</span>
            </Link>
          </>
        )}

        {user.role === "DOCTOR" && (
          <>
            <Link
              href="/doctor"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname === "/doctor" ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Stethoscope className="w-5 h-5 mb-0.5" />
              <span>Rounds</span>
            </Link>
            <Link
              href="/patients"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/patients") ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span>Patients</span>
            </Link>
            <Link
              href="/discharge"
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/discharge") ? "text-sky-600 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-5 h-5 mb-0.5" />
              <span>Discharge</span>
            </Link>
          </>
        )}

        {/* Universal Switch User tab */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium text-slate-500 hover:text-red-600"
        >
          <LogOut className="w-5 h-5 mb-0.5" />
          <span>Switch</span>
        </button>
      </div>
    </nav>
  );
}

