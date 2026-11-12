"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { X, Bell, Check, ExternalLink, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { useApp } from "./AppContext";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export function NotificationsDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { refreshTrigger } = useApp();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/notifications")
        .then((res) => res.json())
        .then((data) => {
          if (data?.notifications) setNotifications(data.notifications);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, refreshTrigger]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-600" />
            <h2 className="font-bold text-base text-slate-900 dark:text-white">Ward Alerts & Updates</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="text-xs text-sky-600 hover:underline font-medium dark:text-sky-400"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No notifications at this time.</div>
          ) : (
            notifications.map((n) => {
              const icon =
                n.type === "ALERT" ? (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : n.type === "SUCCESS" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                );

              return (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border transition-colors ${
                    !n.isRead
                      ? "bg-sky-50/60 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800"
                      : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{n.title}</h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          <span>Open action</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

