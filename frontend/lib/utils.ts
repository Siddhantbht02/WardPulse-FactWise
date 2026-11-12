import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTemp(tempC?: number | null, unit: "C" | "F" = "C"): string {
  if (tempC === null || tempC === undefined || isNaN(Number(tempC))) {
    return unit === "F" ? "--.-°F" : "--.-°C";
  }
  const val = Number(tempC);
  if (unit === "F") {
    const tempF = (val * 9) / 5 + 32;
    return `${tempF.toFixed(1)}°F`;
  }
  return `${val.toFixed(1)}°C`;
}

export function getFeverStatus(tempC: number, threshold = 38.0): {
  isFever: boolean;
  label: string;
  badgeClass: string;
} {
  if (tempC >= threshold) {
    return {
      isFever: true,
      label: "Fever",
      badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    };
  }
  return {
    isFever: false,
    label: "Normal",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  };
}

