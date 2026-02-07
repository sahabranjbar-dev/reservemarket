"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import prisma from "@/utils/prisma";
import { authOptions } from "@/utils/authOptions";
import { convertToEnglishDigits } from "@/utils/common";
import { BusinessRole } from "@/constants/enums";

interface Params {
  staffPhone: string;
  serviceName: string;
  price: number;
  duration: number;
  staffName: string;
}

export async function setupBusinessAction({
  duration,
  price,
  serviceName,
  staffName,
  staffPhone,
}: Params) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "دسترسی غیرمجاز" };
  }

  const businessId = session.user.business?.id;

  if (!businessId) {
    return { success: false, error: "کسب‌وکار یافت نشد" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. بررسی وجود بیزنس
      const business = await tx.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new Error("BUSINESS_NOT_FOUND");
      }

      // 2. ایجاد یا دریافت یوزر با نقش USER
      const user = await tx.user.upsert({
        where: { phone: convertToEnglishDigits(staffPhone) },
        update: {},
        create: {
          phone: convertToEnglishDigits(staffPhone),
          fullName: staffName,
          roles: {
            create: { role: "CUSTOMER" },
          },
        },
        include: { roles: true },
      });

      // اطمینان از داشتن نقش USER
      const hasUserRole = user.roles.some((r) => r.role === "CUSTOMER");
      if (!hasUserRole) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            role: "CUSTOMER",
          },
        });
      }

      // 3. بررسی staff تکراری
      const existingStaff = await tx.staffMember.findFirst({
        where: {
          businessId: business.id,
          phone: convertToEnglishDigits(staffPhone),
        },
      });

      if (existingStaff) {
        throw new Error("STAFF_ALREADY_EXISTS");
      }

      // 4. ایجاد پرسنل و اتصال به یوزر
      const staff = await tx.staffMember.create({
        data: {
          name: staffName,
          phone: convertToEnglishDigits(staffPhone),
          businessId: business.id,
          userId: user.id,
        },
      });

      // 5. اتصال یوزر به بیزنس با نقش STAFF
      await tx.businessMember.upsert({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId: business.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          businessId: business.id,
          role: BusinessRole.STAFF,
        },
      });

      // 6. ایجاد سرویس
      const service = await tx.service.create({
        data: {
          name: serviceName,
          price,
          duration,
          businessId: business.id,
        },
      });

      // 7. لاگ ایجاد سرویس داخل transaction
      await tx.auditLog.create({
        data: {
          action: "BUSINESS_SETUP_SERVICE_CREATED",
          entityType: "SERVICE",
          entityId: service.id,
          businessId: business.id,
          performedBy: session.user.id,
          actorRole: BusinessRole.OWNER,
          metadata: {
            serviceName,
            price,
            duration,
            staffName,
          },
        },
      });

      // 8. اتصال سرویس به پرسنل
      await tx.serviceStaff.create({
        data: {
          serviceId: service.id,
          staffId: staff.id,
        },
      });

      // 9. ایجاد برنامه کاری پیش‌فرض (۷ روز، ۹ تا ۱۷)
      const availabilities = Array.from({ length: 7 }).map((_, dayOfWeek) => ({
        staffId: staff.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:00",
        isClosed: false,
      }));

      await tx.staffAvailability.createMany({
        data: availabilities,
      });
    });

    // 10. بروزرسانی کش
    revalidatePath("/dashboard/business");

    return { success: true };
  } catch (error: any) {
    console.error("SETUP_BUSINESS_ERROR:", error);

    if (error.message === "BUSINESS_NOT_FOUND") {
      return { success: false, error: "کسب‌وکار معتبر نیست" };
    }

    if (error.message === "STAFF_ALREADY_EXISTS") {
      return {
        success: false,
        error: "این پرسنل قبلاً در کسب‌وکار ثبت شده است",
      };
    }

    return { success: false, error: "خطا در راه‌اندازی اولیه کسب‌وکار" };
  }
}
