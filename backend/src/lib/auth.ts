import { Request, Response } from "express";
import { prisma } from "./prisma";

export interface SessionUser {
  id: string;
  name: string;
  role: "ADMIN" | "NURSE" | "DOCTOR";
  avatar?: string | null;
}

// In-memory rate limiting map for PIN attempts
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
export const SESSION_COOKIE_NAME = "wardpulse_session";

export function createSessionCookie(res: Response, user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64");
  res.cookie(SESSION_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

export function getSessionUser(req: Request): SessionUser | null {
  try {
    const cookieVal = req.cookies?.[SESSION_COOKIE_NAME];
    if (!cookieVal) return null;
    const jsonStr = Buffer.from(cookieVal, "base64").toString("utf-8");
    return JSON.parse(jsonStr) as SessionUser;
  } catch {
    return null;
  }
}
