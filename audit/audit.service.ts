"use server";

import prisma from "@/utils/prisma";

interface CreateAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;

  businessId?: string;
  performedBy?: string;
  actorRole?: string;

  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(
  params: CreateAuditLogParams,
): Promise<void> {
  const {
    action,
    entityType,
    entityId,
    businessId,
    performedBy,
    actorRole,
    metadata,
    ip,
    userAgent,
  } = params;

  if (!action || !entityType || !entityId) {
    console.warn("AuditLog skipped: missing required fields", params);
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        businessId,
        performedBy,
        actorRole,
        metadata,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", {
      action,
      entityType,
      entityId,
      error,
    });
  }
}
