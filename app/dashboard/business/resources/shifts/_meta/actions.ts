"use server";

import prisma from "@/utils/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { BusinessRole } from "@/constants/enums";

export async function getStaffAction(businessId: string) {
  try {
    const staff = await prisma.staffMember.findMany({
      where: { businessId, isActive: true, deletedAt: null },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: staff };
  } catch (error) {
    console.error("Get Staff Error:", error);
    return { success: false, error: "خطا در دریافت لیست پرسنل" };
  }
}

export async function getStaffScheduleAction(staffId: string) {
  try {
    const schedules = await prisma.staffAvailability.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: "asc" },
    });
    return { success: true, data: schedules };
  } catch (error) {
    console.error("Get Staff Schedule Error:", error);
    return { success: false, error: "خطا در دریافت شیفت‌ها" };
  }
}

export async function upsertScheduleAction(staffId: string, schedules: any[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    for (const sch of schedules) {
      if (!sch.isClosed && sch.startTime >= sch.endTime) {
        return {
          success: false,
          error: `زمان پایان در ${sch.label} باید بعد از زمان شروع باشد.`,
        };
      }
    }

    const updatedSchedules = await prisma.$transaction(
      schedules.map((schedule) =>
        prisma.staffAvailability.upsert({
          where: {
            staffId_dayOfWeek: { staffId, dayOfWeek: schedule.dayOfWeek },
          },
          update: {
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isClosed: schedule.isClosed,
          },
          create: {
            staffId,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isClosed: schedule.isClosed,
          },
        }),
      ),
    );

    await prisma.auditLog.create({
      data: {
        action: "STAFF_SCHEDULE_UPSERT",
        entityType: "STAFF",
        entityId: staffId,
        businessId: session.user.business?.id ?? "",
        performedBy: session.user.id,
        actorRole: session.user.business?.businessRole ?? BusinessRole.OWNER,
        metadata: { schedules },
      },
    });

    // ری‌والید مسیر
    revalidatePath("/dashboard/business/settings/shifts");

    return {
      success: true,
      message: "شیفت‌ها با موفقیت ذخیره شدند",
      data: updatedSchedules,
    };
  } catch (error) {
    console.error("Upsert Schedule Error:", error);
    return { success: false, error: "خطا در ذخیره سازی" };
  }
}
