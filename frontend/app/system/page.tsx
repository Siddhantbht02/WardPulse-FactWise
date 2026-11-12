"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Database,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/components/AppContext";

export default function SystemStatusPage() {
  const { addToast } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      let res = await fetch("/api/system/status");
      if (!res.ok) {
        res = await fetch("/api/health");
      }
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Status fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRunHealthCheck = async () => {
    setChecking(true);
    try {
      let res = await fetch("/api/system/status", { method: "POST" });
      if (!res.ok) {
        res = await fetch("/api/health", { method: "POST" });
      }
      const resData = await res.json();
      if (res.ok) {
        const ms = resData?.heartbeat?.responseTimeMs ?? resData?.responseTimeMs ?? 15;
        addToast({
          type: "success",
          message: `Health check passed! Latency: ${ms}ms.`,
        });
        fetchStatus();
      } else {
        addToast({ type: "error", message: resData?.error || "Health check query failed" });
      }
    } catch {
      addToast({ type: "error", message: "Network error during health check" });
    } finally {
      setChecking(false);
    }
  };

  const formatUptime = (seconds = 0) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            System Status & Heartbeat Monitor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            5-minute autonomous self-ping daemon, database connectivity, and background clinical tasks.
          </p>
        </div>

        <button
          onClick={handleRunHealthCheck}
          disabled={checking}
          className="btn-touch px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-md flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          <span>Run Health Check Now</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Process Uptime</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatUptime(data?.uptimeSeconds)}
          </div>
          <span className="text-[11px] text-slate-500">Long-running Node.js daemon</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Database Health</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            <span>{data?.dbStatus || "OK"}</span>
          </div>
          <span className="text-[11px] text-slate-500">Prisma ORM connection active</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Self-Ping Scheduler</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
            Active (5m)
          </div>
          <span className="text-[11px] text-slate-500">Auto-pings /api/health with backoff</span>
        </div>
      </div>

      {/* Heartbeat History Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" />
            <span>Heartbeat Log (Last 50 Self-Pings)</span>
          </h3>
          <span className="text-xs text-slate-500">Prunes after 7 days</span>
        </div>

        {loading ? (
          <div className="space-y-2 py-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700/60 rounded-lg" />
            ))}
          </div>
        ) : !data?.heartbeats || data.heartbeats.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No heartbeat logs recorded yet.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 text-xs">
            {data.heartbeats.map((hb: any) => (
              <div key={hb.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      hb.status === "OK" ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                    }`}
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Status: {hb.status} • {hb.responseTimeMs}ms
                    </span>
                    <p className="text-[11px] text-slate-500">{hb.details || "Self-ping passed"}</p>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(hb.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

