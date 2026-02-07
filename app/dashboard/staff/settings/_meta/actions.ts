"use server";

import { authOptions } from "@/utils/authOptions";
import { convertToEnglishDigits, validateEmail } from "@/utils/common";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

interface IData {
  phone: string;
  email?: string | null;
  username?: string | null;
  fullName?: string | null;
}

const updateSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform(convertToEnglishDigits)
    .pipe(
      z.string().regex(/^09\d{9}$/, {
        message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود",
      }),
    ),
  fullName: z.string().trim().min(2, "نام معتبر نیست").nullable().optional(),
  email: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((email) => email === null || validateEmail(email, false).valid, {
      message: "فرمت ایمیل صحیح نیست",
    }),
  username: z
    .string()
    .trim()
    .min(3, "نام کاربری حداقل ۳ کاراکتر است")
    .nullable()
    .optional(),
});

export async function updateStaffProfileAction(data: IData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  const userId = session.user.id;
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error?.message ?? "اطلاعات نامعتبر است",
    };

  const { phone, email, fullName, username } = parsed.data;

  try {
    const phoneExists = await prisma.user.findFirst({
      where: { phone, id: { not: userId } },
    });
    if (phoneExists)
      return { success: false, message: "این شماره موبایل قبلاً ثبت شده است" };

    if (username) {
      const usernameExists = await prisma.user.findFirst({
        where: { username, id: { not: userId } },
      });
      if (usernameExists)
        return { success: false, message: "نام کاربری قبلاً استفاده شده است" };
    }

    const updateData: Record<string, any> = { phone };
    if (email !== undefined) updateData.email = email || null;
    if (username !== undefined) updateData.username = username || null;
    if (fullName !== undefined) updateData.fullName = fullName || null;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "STAFF_PROFILE_UPDATED",
          entityType: "USER",
          entityId: userId,
          businessId: session.user.business?.id ?? null,
          performedBy: userId,
          actorRole: "STAFF",
          metadata: updateData,
        },
      });

      return user;
    });

    revalidatePath("/dashboard/staff/settings");

    return {
      success: true,
      message: "اطلاعات پروفایل با موفقیت ذخیره شد",
      updatedUser,
    };
  } catch (error) {
    console.error("updateStaffProfileAction error:", error);
    return {
      success: false,
      message: "خطای غیرمنتظره‌ای رخ داد، لطفاً دوباره تلاش کنید",
    };
  }
}

export async function getStaffAvailability() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user.id;

    const staff = await prisma.staffMember.findFirst({ where: { userId } });
    const staffId = staff?.id;

    const staffAvailability = await prisma.staffAvailability.findMany({
      where: { staffId },
    });
    return { success: true, staffAvailability };
  } catch (error) {
    console.error("getStaffAvailability error:", error);
    return {
      success: false,
      message: "خطای غیرمنتظره‌ای رخ داد، لطفاً دوباره تلاش کنید",
    };
  }
}

interface Schedule {
  dayOfWeek: number;
  isClosed: boolean;
  startTime: string;
  endTime: string;
  label?: string;
}

export async function upsertStaffScheduleAction(
  schedules: Schedule[],
  breakMinutes?: number,
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user.id;
    const businessId = session?.user.business?.id;

    if (!userId || !businessId)
      return { success: false, message: "دسترسی ندارید" };

    const staff = await prisma.staffMember.findFirst({ where: { userId } });
    if (!staff) return { success: false, message: "همکار پیدا نشد" };

    const staffId = staff.id;

    // اعتبارسنجی ساده: پایان زمان باید بعد از شروع باشد
    for (const sch of schedules) {
      if (!sch.isClosed && sch.startTime >= sch.endTime)
        return {
          success: false,
          error: `زمان پایان در ${sch.label} باید بعد از زمان شروع باشد.`,
        };
    }

    await prisma.$transaction(async (tx) => {
      for (const schedule of schedules) {
        await tx.staffAvailability.upsert({
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
        });
      }

      await tx.staffMember.update({
        where: { businessId_userId: { userId, businessId } },
        data: { breakMinutes },
      });

      // Audit Log → serialize کردن JSON
      await tx.auditLog.create({
        data: {
          action: "STAFF_SCHEDULE_UPDATED",
          entityType: "STAFF_AVAILABILITY",
          entityId: staffId,
          businessId,
          performedBy: userId,
          actorRole: "STAFF",
          metadata: JSON.parse(JSON.stringify({ schedules, breakMinutes })),
        },
      });
    });

    revalidatePath("/dashboard/staff/settings");

    return { success: true, message: "شیفت‌ها با موفقیت ذخیره شدند" };
  } catch (error) {
    console.error("upsertStaffScheduleAction error:", error);
    return { success: false, error: "خطا در ذخیره سازی" };
  }
}
