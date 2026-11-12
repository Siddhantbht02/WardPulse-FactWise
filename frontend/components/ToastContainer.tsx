"use client";

import React from "react";
import { useApp } from "./AppContext";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, Undo2 } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          info: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
          success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
        };

        const bg = {
          info: "bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200",
          success: "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200",
          warning: "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200",
          error: "bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-center justify-between gap-3 ${bg[toast.type]} animate-in slide-in-from-bottom-5 duration-200`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icons[toast.type]}
              <span className="text-xs font-semibold leading-snug">{toast.message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.undoAction && (
                <button
                  onClick={() => {
                    toast.undoAction?.();
                    removeToast(toast.id);
                  }}
                  className="px-2.5 py-1 rounded bg-white text-slate-800 text-xs font-bold shadow hover:bg-slate-100 flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded hover:bg-black/10 transition-colors"
              >
                <X className="w-4 h-4 opacity-70" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

