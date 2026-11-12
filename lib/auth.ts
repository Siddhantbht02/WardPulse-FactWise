import { cookies } from "next/headers";
import { prisma } from "./prisma";

export interface SessionUser {
  id: string;
  name: string;
  role: "ADMIN" | "NURSE" | "DOCTOR";
  avatar?: string | null;
}

// In-memory rate limiting map for PIN attempts
// Key: userId or IP, Value: { attempts: number, lockedUntil?: number }
const loginAttempts = new Map<string, { attempts: number; lockedUntil?: number }>();

export function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil && record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (record.lockedUntil && record.lockedUntil <= now) {
    // Lockout expired
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordLoginFailure(key: string): { locked: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key) || { attempts: 0 };
  record.attempts += 1;

  if (record.attempts >= 5) {
    record.lockedUntil = now + 60 * 1000; // 1 minute lockout
    loginAttempts.set(key, record);
    return { locked: true, waitSeconds: 60 };
  }

  loginAttempts.set(key, record);
  return { locked: false };
}

export function resetLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

// Cookie session helpers
const SESSION_COOKIE_NAME = "wardpulse_session";

export function createSessionCookie(user: SessionUser) {
  const cookieStore = cookies();
  const payload = Buffer.from(JSON.stringify(user)).toString("base64");
  cookieStore.set(SESSION_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60, // 30 minutes inactivity timeout
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function getSessionUser(): SessionUser | null {
  const cookieStore = cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const raw = Buffer.from(cookie.value, "base64").toString("utf-8");
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

