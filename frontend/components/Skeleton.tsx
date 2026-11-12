import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800/80 transition-colors",
        className
      )}
      {...props}
    />
  );
}

// Full page skeleton for Patient Details (/patients/[id])
export function PatientDetailSkeleton() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Action button */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>

      {/* Patient Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-20 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-4 w-60 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
        </div>
      </div>

      {/* 7-Day Fever-Free Streak Tracker */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 dark:from-slate-800 dark:to-slate-850 border border-purple-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-56 rounded-md" />
            <Skeleton className="h-3.5 w-72 rounded-md" />
          </div>
          <Skeleton className="h-6 w-36 rounded-full" />
        </div>

        {/* 7-Day Circle History Grid */}
        <div className="grid grid-cols-7 gap-2 pt-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2">
              <Skeleton className="h-2.5 w-8 rounded" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-2.5 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Temperature Trend Chart & Readings List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Timeline Skeleton */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <Skeleton className="h-5 w-48 rounded-md" />
        <div className="space-y-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-3 w-full max-w-md rounded-md" />
              <Skeleton className="h-2.5 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 74-Bed Ward Grid Skeleton for Admin Dashboard
export function WardGridSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 KPI summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ))}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-xl" />
      </div>

      {/* 74 Bed Floor Plan Tiles Grid */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
          {[...Array(30)].map((_, i) => (
            <div key={i} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-1.5">
              <Skeleton className="h-4 w-8 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-2 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Table / List Skeleton
export function TableListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36 rounded" />
        <Skeleton className="h-8 w-48 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-12 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

