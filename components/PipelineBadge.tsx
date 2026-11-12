import React from "react";
import { Clock, Stethoscope, CheckCircle2, Sparkles, AlertTriangle, UserCheck } from "lucide-react";
import { PipelineState } from "@/lib/rules";

interface PipelineBadgeProps {
  state: PipelineState;
  isOverdueTemp?: boolean;
  isOverdueDoctor?: boolean;
  size?: "sm" | "md";
}

export function PipelineBadge({
  state,
  isOverdueTemp = false,
  isOverdueDoctor = false,
  size = "md",
}: PipelineBadgeProps) {
  const isOverdue = isOverdueTemp || isOverdueDoctor;

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  if (state === "DISCHARGE_ELIGIBLE") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 animate-pulse ${sizeClass}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Discharge Ready
      </span>
    );
  }

  if (isOverdue) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-300 animate-pulse-fast ${sizeClass}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
        {isOverdueTemp ? "Overdue Temp" : "Overdue Doctor"}
      </span>
    );
  }

  switch (state) {
    case "NEEDS_TEMP":
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 ${sizeClass}`}
        >
          <Clock className="w-3.5 h-3.5" />
          Needs Temp
        </span>
      );
    case "READY_FOR_DOCTOR":
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950 dark:text-sky-300 ${sizeClass}`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          Ready for Doc
        </span>
      );
    case "SEEN":
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 ${sizeClass}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Seen Today
        </span>
      );
    case "DISCHARGED":
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClass}`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Discharged
        </span>
      );
    case "DECEASED":
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-zinc-200 text-zinc-800 border border-zinc-400 ${sizeClass}`}
        >
          Deceased
        </span>
      );
    default:
      return null;
  }
}

