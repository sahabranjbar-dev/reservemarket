"use server";

import { authOptions } from "@/utils/authOptions";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { createLog } from "@/log/log.service"; // اضافه شد

interface IupsertService {
  name: string;
  price?: number | null;
  duration: number;
  businessId: string;
  id?: string;
  staffIds: string[];
}

// -------------------------
// ایجاد یا آپدیت سرویس
// -------------------------
export async function upsertService(data: IupsertService) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const businessId = session.user?.business?.id ?? "";

  try {
    const { name, price, duration, id, staffIds } = data;

    const service = await prisma.$transaction(async (tx) => {
      // 1. ایجاد یا آپدیت سرویس
      let service;
      if (id) {
        service = await tx.service.update({
          where: { id },
          data: { name, price, duration },
        });
      } else {
        service = await tx.service.create({
          data: { name, price, duration, businessId },
        });
      }

      // 2. آپدیت رزروهای آینده
      if (id) {
        const futureBookings = await tx.booking.findMany({
          where: {
            serviceId: service.id,
            startTime: { gte: new Date() },
            deletedAt: null,
          },
          select: { id: true, startTime: true },
        });

        if (futureBookings.length > 0) {
          await Promise.all(
            futureBookings.map((b) =>
              tx.booking.update({
                where: { id: b.id },
                data: {
                  endTime: new Date(
                    b.startTime.getTime() + duration * 60 * 1000,
                  ),
                },
              }),
            ),
          );
          await createLog({
            level: "INFO",
            message: "Future bookings updated after service change",
            context: {
              serviceId: service.id,
              updatedBookings: futureBookings.length,
            },
          });
        }
      }

      // 3. مدیریت پرسنل
      await tx.serviceStaff.deleteMany({ where: { serviceId: service.id } });

      if (staffIds.length > 0) {
        const validStaffs = await tx.staffMember.findMany({
          where: {
            id: { in: staffIds },
            businessId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (validStaffs.length !== staffIds.length) {
          await createLog({
            level: "ERROR",
            message: "Attempted to assign invalid staff to service",
            context: { serviceId: id || "N/A", staffIds },
          });
          throw new Error("INVALID_STAFF");
        }

        await tx.serviceStaff.createMany({
          data: validStaffs.map((s) => ({
            serviceId: service.id,
            staffId: s.id,
          })),
        });
      }

      // 4. ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: id ? "SERVICE_UPDATED" : "SERVICE_CREATED",
          entityType: "SERVICE",
          entityId: service.id,
          businessId,
          performedBy: session.user.id,
          actorRole: "OWNER",
          metadata: { name, price, duration, staffIds },
        },
      });

      await createLog({
        level: "INFO",
        message: id ? "Service updated" : "Service created",
        context: { serviceId: service.id, userId: session.user.id },
      });

      return service;
    });

    revalidatePath("/dashboard/business/resources/services");

    return { success: true, message: "عملیات با موفقیت انجام شد", service };
  } catch (error: any) {
    console.error("upsertService Error:", error);

    await createLog({
      level: "ERROR",
      message: "upsertService failed",
      context: { error: error.message, data },
    });

    if (error.message === "INVALID_STAFF") {
      return {
        success: false,
        error: "پرسنل نامعتبر یا خارج از این کسب‌وکار انتخاب شده است",
      };
    }

    return { success: false, error: "خطای سرور" };
  }
}

// -------------------------
// حذف سرویس
// -------------------------
export async function deleteService(serviceId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.$transaction(async (tx) => {
      // 1. حذف ارتباطات پرسنل
      await tx.serviceStaff.deleteMany({ where: { serviceId } });

      // 2. soft-delete سرویس
      await tx.service.update({
        where: { id: serviceId },
        data: { deletedAt: new Date() },
      });

      // 3. ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: "SERVICE_DELETED",
          entityType: "SERVICE",
          entityId: serviceId,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: "OWNER",
          metadata: {},
        },
      });

      await createLog({
        level: "INFO",
        message: "Service deleted",
        context: { serviceId, userId: session.user.id },
      });
    });

    revalidatePath("/dashboard/business/resources/services");

    return { success: true, message: "خدمت حذف شد." };
  } catch (error: any) {
    console.error("deleteService Error:", error);

    await createLog({
      level: "ERROR",
      message: "deleteService failed",
      context: { error: error.message, serviceId },
    });

    return { success: false, error: "خطای سرور" };
  }
}
