import { prisma } from "./prisma";
import { sseManager } from "./sse";

export async function createAuditLog(params: {
  userId?: string | null;
  userName: string;
  role: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: any;
}) {
  try {
    const log = await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        userName: params.userName,
        role: params.role,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        payload: params.payload ? JSON.stringify(params.payload) : null,
      },
    });

    sseManager.broadcast("AUDIT_LOG_CREATED", log);
    return log;
  } catch (err) {
    console.error("Failed to create audit log:", err);
  }
}

