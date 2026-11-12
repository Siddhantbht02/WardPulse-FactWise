import React from "react";

interface StreakDotsProps {
  streak: number;
  requiredDays?: number;
  className?: string;
}

export function StreakDots({ streak, requiredDays = 3, className = "" }: StreakDotsProps) {
  const dots = [];
  for (let i = 0; i < requiredDays; i++) {
    const isCompleted = i < streak;
    dots.push(
      <span
        key={i}
        className={`inline-block w-2.5 h-2.5 rounded-full transition-colors ${
          isCompleted
            ? "bg-purple-600 shadow-sm shadow-purple-300"
            : "bg-slate-300 dark:bg-slate-700"
        }`}
        title={`Day ${i + 1} fever-free`}
      />
    );
  }

  const isEligible = streak >= requiredDays;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-1">{dots}</div>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {isEligible ? (
          <span className="text-purple-700 font-bold">Ready to Discharge ({streak}/{requiredDays})</span>
        ) : (
          <span>{streak} of {requiredDays} fever-free</span>
        )}
      </span>
    </div>
  );
}

