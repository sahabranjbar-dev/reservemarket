"use server";

import { BusinessRole } from "@/constants/enums";
import { authOptions } from "@/utils/authOptions";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

// -----------------------------
// 1️⃣ دریافت جزئیات درخواست تغییر سرویس
// -----------------------------
export async function getStaffServiceChangeRequestDetails(id: string) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      session.user.business?.businessRole !== BusinessRole.OWNER
    ) {
      return { success: false, message: "دسترسی ندارید" };
    }

    if (!id) return { success: false, message: "شناسه الزامی است" };

    const changeRequest = await prisma.staffServiceChangeRequest.findUnique({
      where: { id },
      include: {
        service: true,
        staff: { select: { name: true, phone: true } },
      },
    });

    if (!changeRequest) return { success: false, message: "اطلاعاتی یافت نشد" };

    return { success: true, changeRequest };
  } catch (error) {
    console.error("Get Change Request Details Error:", error);
    return { success: false, message: "خطای سرور" };
  }
}

// -----------------------------
// 2️⃣ تایید درخواست تغییر سرویس
// -----------------------------
export async function approveStaffServiceChangeRequest(id: string) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      session.user.business?.businessRole !== BusinessRole.OWNER
    ) {
      return { success: false, message: "دسترسی ندارید" };
    }

    if (!id) return { success: false, message: "شناسه الزامی است" };

    const changeRequest = await prisma.staffServiceChangeRequest.findUnique({
      where: { id },
    });
    if (!changeRequest) return { success: false, message: "درخواست یافت نشد" };
    if (changeRequest.status !== "PENDING")
      return { success: false, message: "این درخواست قبلاً بررسی شده است" };

    const result = await prisma.$transaction(async (tx) => {
      // بروزرسانی وضعیت درخواست
      const updatedRequest = await tx.staffServiceChangeRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

      // بروزرسانی سرویس
      const updatedService = await tx.service.update({
        where: { id: changeRequest.serviceId },
        data: {
          ...(changeRequest.requestedPrice !== null && {
            price: changeRequest.requestedPrice,
          }),
          ...(changeRequest.requestedDuration !== null && {
            duration: changeRequest.requestedDuration,
          }),
          ...(changeRequest.requestedDescription !== null && {
            description: changeRequest.requestedDescription,
          }),
          ...(changeRequest.requestedName && {
            name: changeRequest.requestedName,
          }),
          ...(changeRequest.requestedActive !== null && {
            isActive: changeRequest.requestedActive,
          }),
        },
      });

      // ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: "STAFF_SERVICE_CHANGE_APPROVED",
          entityType: "STAFF_SERVICE_CHANGE_REQUEST",
          entityId: id,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: BusinessRole.OWNER,
          metadata: {
            updatedFields: {
              price: changeRequest.requestedPrice,
              duration: changeRequest.requestedDuration,
              name: changeRequest.requestedName,
              description: changeRequest.requestedDescription,
              isActive: changeRequest.requestedActive,
            },
          },
        },
      });

      return { updatedRequest, updatedService };
    });

    revalidatePath("/dashboard/business/resources/change-requests");
    return { success: true, result };
  } catch (error) {
    console.error("Approve Change Request Error:", error);
    return { success: false, message: "خطای سرور" };
  }
}

// -----------------------------
// 3️⃣ رد درخواست تغییر سرویس
// -----------------------------
export async function rejectStaffServiceChangeRequest(
  id: string,
  reason?: string,
) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      session.user.business?.businessRole !== BusinessRole.OWNER
    ) {
      return { success: false, message: "دسترسی ندارید" };
    }

    if (!id) return { success: false, message: "شناسه الزامی است" };

    const changeRequest = await prisma.staffServiceChangeRequest.findUnique({
      where: { id },
    });
    if (!changeRequest) return { success: false, message: "درخواست یافت نشد" };
    if (changeRequest.status !== "PENDING")
      return { success: false, message: "این درخواست قبلاً بررسی شده است" };

    const rejectedRequest = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.staffServiceChangeRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: reason ?? "بدون توضیح",
          reviewedAt: new Date(),
        },
      });

      // ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: "STAFF_SERVICE_CHANGE_REJECTED",
          entityType: "STAFF_SERVICE_CHANGE_REQUEST",
          entityId: id,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: BusinessRole.OWNER,
          metadata: { reason: reason ?? "بدون توضیح" },
        },
      });

      return updatedRequest;
    });

    revalidatePath("/dashboard/business/resources/change-requests");
    return { success: true, rejectedRequest };
  } catch (error) {
    console.error("Reject Change Request Error:", error);
    return { success: false, message: "خطای سرور" };
  }
}
