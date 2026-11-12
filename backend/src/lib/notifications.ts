import { prisma } from "./prisma";
import { sseManager } from "./sse";

export async function createNotification(params: {
  userId?: string | null;
  role?: string | null; // ALL, ADMIN, NURSE, DOCTOR
  title: string;
  message: string;
  type?: "INFO" | "WARNING" | "ALERT" | "SUCCESS";
  link?: string;
}) {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: params.userId || null,
        role: params.role || null,
        title: params.title,
        message: params.message,
        type: params.type || "INFO",
        link: params.link || null,
      },
    });

    sseManager.broadcast("NOTIFICATION_CREATED", notif);
    return notif;
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

