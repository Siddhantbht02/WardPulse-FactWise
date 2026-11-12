"use client";

import React, { useState, useEffect } from "react";
import { X, Settings, Check, RefreshCw } from "lucide-react";
import { useApp } from "./AppContext";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addToast, triggerRefresh, darkMode, toggleDarkMode, highContrast, setHighContrast } = useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [feverThreshold, setFeverThreshold] = useState("38.0");
  const [requiredFeverFreeDays, setRequiredFeverFreeDays] = useState("3");
  const [benchmarkMortality, setBenchmarkMortality] = useState("15");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [tempCutoffHour, setTempCutoffHour] = useState("12");
  const [doctorCutoffHour, setDoctorCutoffHour] = useState("17");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data?.settings) {
            setFeverThreshold(String(data.settings.feverThreshold));
            setRequiredFeverFreeDays(String(data.settings.requiredFeverFreeDays));
            setBenchmarkMortality(String(data.settings.benchmarkMortality * 100));
            setTimezone(data.settings.timezone);
            setTempCutoffHour(String(data.settings.tempCutoffHour));
            setDoctorCutoffHour(String(data.settings.doctorCutoffHour));
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feverThreshold: parseFloat(feverThreshold),
          requiredFeverFreeDays: parseInt(requiredFeverFreeDays, 10),
          benchmarkMortality: parseFloat(benchmarkMortality) / 100,
          timezone,
          tempCutoffHour: parseInt(tempCutoffHour, 10),
          doctorCutoffHour: parseInt(doctorCutoffHour, 10),
        }),
      });

      if (res.ok) {
        addToast({ type: "success", message: "Facility settings updated successfully." });
        triggerRefresh();
        onClose();
      } else {
        const err = await res.json();
        addToast({ type: "error", message: err.error || "Failed to save settings" });
      }
    } catch {
      addToast({ type: "error", message: "Network error saving settings" });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Facility Clinical Parameters</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fever Threshold (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="37.0"
                  max="40.0"
                  value={feverThreshold}
                  onChange={(e) => setFeverThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                  required
                />
                <span className="text-[10px] text-slate-500">Standard: 38.0°C</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Required Fever-Free Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={requiredFeverFreeDays}
                  onChange={(e) => setRequiredFeverFreeDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                  required
                />
                <span className="text-[10px] text-slate-500">Sole discharge criterion</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Benchmark Mortality (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="50"
                  value={benchmarkMortality}
                  onChange={(e) => setBenchmarkMortality(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                  required
                />
                <span className="text-[10px] text-slate-500">Benchmark: 15% (85% cure)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Facility Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
                <span className="text-[10px] text-slate-500">Day boundary reference</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Temp Cutoff (Hour 0-23)
                </label>
                <input
                  type="number"
                  min="6"
                  max="20"
                  value={tempCutoffHour}
                  onChange={(e) => setTempCutoffHour(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                />
                <span className="text-[10px] text-slate-500">Overdue after 12:00</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Doctor Cutoff (Hour 0-23)
                </label>
                <input
                  type="number"
                  min="12"
                  max="23"
                  value={doctorCutoffHour}
                  onChange={(e) => setDoctorCutoffHour(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                />
                <span className="text-[10px] text-slate-500">Overdue after 17:00</span>
              </div>
            </div>

            {/* Display & Visual Theme Section */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Dark Appearance</h4>
                <p className="text-[11px] text-slate-500">Toggle dark palette for low-light or night ward shifts</p>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  darkMode
                    ? "bg-amber-500 text-slate-900 shadow-sm"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300"
                }`}
              >
                {darkMode ? "Dark Active" : "Light Mode"}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 shadow flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Parameters</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

