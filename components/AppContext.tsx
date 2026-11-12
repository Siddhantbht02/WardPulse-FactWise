"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface SessionUser {
  id: string;
  name: string;
  role: "ADMIN" | "NURSE" | "DOCTOR";
  avatar?: string | null;
}

interface ToastMessage {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  undoAction?: () => void;
  undoLabel?: string;
}

interface AppContextType {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  sseConnected: boolean;
  darkMode: boolean;
  setDarkMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleDarkMode: () => void;
  highContrast: boolean;
  setHighContrast: (v: boolean | ((prev: boolean) => boolean)) => void;
  toasts: ToastMessage[];
  addToast: (msg: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  playAlertSound: () => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();

  // Initialize theme from localStorage or system preference on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem("wardpulse_theme");
      const savedContrast = localStorage.getItem("wardpulse_contrast");

      if (savedTheme === "dark") {
        setDarkMode(true);
        document.documentElement.classList.add("dark");
      } else if (savedTheme === "light") {
        setDarkMode(false);
        document.documentElement.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setDarkMode(prefersDark);
        if (prefersDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }

      if (savedContrast === "true") {
        setHighContrast(true);
        document.documentElement.classList.add("high-contrast");
      }
    } catch {}
  }, []);

  // Sync dark mode class and storage whenever darkMode changes
  useEffect(() => {
    if (!mounted) return;
    try {
      if (darkMode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("wardpulse_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("wardpulse_theme", "light");
      }
    } catch {}
  }, [darkMode, mounted]);

  // Sync high contrast class and storage
  useEffect(() => {
    if (!mounted) return;
    try {
      if (highContrast) {
        document.documentElement.classList.add("high-contrast");
        localStorage.setItem("wardpulse_contrast", "true");
      } else {
        document.documentElement.classList.remove("high-contrast");
        localStorage.setItem("wardpulse_contrast", "false");
      }
    } catch {}
  }, [highContrast, mounted]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: ToastMessage = { ...msg, id };
    setToasts((prev) => [newToast, ...prev]);

    // Auto-dismiss after 5 seconds (or 60s if undoAction is present)
    const timeout = msg.undoAction ? 60000 : 5000;
    setTimeout(() => {
      removeToast(id);
    }, timeout);
  }, [removeToast]);

  const playAlertSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {}
  }, [soundEnabled]);

  // Load session on start
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Global SSE listener
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      eventSource = new EventSource("/api/events");

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 3000); // Auto-reconnect with 3s backoff
      };

      // Listen for broadcast events
      const eventTypes = [
        "READING_RECORDED",
        "READING_UPDATED",
        "VISIT_LOGGED",
        "DISCHARGE_PROCESSED",
        "PATIENT_ADMITTED",
        "PATIENT_DECEASED",
        "BED_CLAIMED",
        "BED_CLAIM_RELEASED",
        "TEMP_REQUESTED",
        "DAY_SIMULATED",
      ];

      eventTypes.forEach((type) => {
        eventSource?.addEventListener(type, (e: any) => {
          try {
            const data = JSON.parse(e.data);
            triggerRefresh();

            if (type === "READING_RECORDED") {
              playAlertSound();
            } else if (type === "TEMP_REQUESTED") {
              addToast({
                type: "warning",
                message: `Priority Temperature Requested for Room ${data.roomNumber || ""}`,
              });
              playAlertSound();
            } else if (type === "DISCHARGE_PROCESSED") {
              addToast({
                type: "success",
                message: `Patient in Room ${data.roomNumber || ""} discharged successfully!`,
              });
            }
          } catch {}
        });
      });
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [triggerRefresh, playAlertSound, addToast]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        sseConnected,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        highContrast,
        setHighContrast,
        toasts,
        addToast,
        removeToast,
        soundEnabled,
        setSoundEnabled,
        playAlertSound,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
