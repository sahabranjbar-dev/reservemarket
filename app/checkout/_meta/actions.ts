"use server";

import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { revalidatePath } from "next/cache";
import { createLog } from "@/log/log.service";
import { notificationQueue } from "@/queues/notification.queue";
import { NotificationType } from "@/constants/enums";

export async function createBookingAction(params: {
  businessId: string;
  staffId: string; // الان این فیلد الزامی شد
  serviceId: string;
  date: string;
  time: string;
  customerNotes?: string;
}) {
  const { businessId, staffId, serviceId, date, time, customerNotes } = params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    await createLog({
      level: "WARN",
      message: "کاربر غیرمجاز تلاش به ایجاد رزرو کرد",
      context: { params },
    });
    return {
      success: false,
      error: "لطفاً ابتدا وارد شوید",
    };
  }

  try {
    // 1. اطلاعات سرویس
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true, price: true, name: true },
    });

    if (!service) {
      await createLog({
        level: "WARN",
        message: "سرویس یافت نشد",
        context: { serviceId, userId: session.user.id },
      });
      return { success: false, error: "سرویس یافت نشد" };
    }

    // 2. ساخت زمان‌ها
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + service.duration * 60000);

    // 3. بررسی نهایی دسترسی پرسنل (Safety Check)
    const staff = await prisma.staffMember.findFirst({
      where: {
        id: staffId,
        businessId: businessId,
        isActive: true,
        deletedAt: null,
        services: { some: { serviceId } },
      },
      include: {
        business: { select: { slug: true, ownerId: true, businessName: true } },
        bookings: {
          where: {
            status: { in: ["PENDING", "CONFIRMED"] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        },
        services: { select: { serviceId: true } },
      },
    });

    if (!staff) {
      await createLog({
        level: "WARN",
        message: "پرسنل نامعتبر برای رزرو انتخاب شد",
        context: { staffId, businessId, userId: session.user.id },
      });
      return { success: false, error: "پرسنل نامعتبر است." };
    }

    if (staff.bookings.length > 0) {
      await createLog({
        level: "INFO",
        message: "رزرو تداخل داشت و موفق نبود",
        context: { staffId, startTime, endTime, userId: session.user.id },
      });
      return {
        success: false,
        error:
          "متاسفانه این پرسنل در این زمان رزرو شد. لطفاً پرسنل دیگری انتخاب کنید.",
      };
    }

    // 4. ثبت رزرو
    const booking = await prisma.booking.create({
      data: {
        businessId,
        customerId: session.user.id,
        serviceId,
        staffId,
        startTime,
        endTime,
        customerNotes,
        status: "PENDING",
      },
      include: {
        staff: true,
        business: true,
      },
    });

    revalidatePath(`/business/detail/${businessId}/${staff.business.slug}`);
    revalidatePath("/checkout");
    revalidatePath("/dashboard/business/bookings");

    await createLog({
      level: "INFO",
      message: "رزرو با موفقیت ایجاد شد",
      context: {
        bookingId: booking.id,
        userId: session.user.id,
        staffId,
        serviceId,
        startTime,
        endTime,
      },
    });

    // 5️⃣ جمع‌آوری کاربران برای Notification
    const admins = await prisma.user.findMany({
      where: {
        roles: { some: { role: "SUPER_ADMIN" } },
      },
      select: { id: true },
    });

    // همه Staff های مرتبط با سرویس (در این مثال فقط یک نفر)
    const staffMembers = await prisma.staffMember.findMany({
      where: { id: staffId },
      select: { id: true, userId: true },
    });

    const notifications = [
      // Customer
      {
        userId: session.user.id,
        title: "رزرو شما ثبت شد",
        body: `رزرو شما برای سرویس ${service.name} با موفقیت ثبت شد.`,
        sendSMS: true,
      },
      // Owner
      {
        userId: booking.business.ownerId,
        title: "رزرو جدید در کسب‌وکار شما",
        body: `یک رزرو جدید برای سرویس ${service.name} توسط مشتری ثبت شد.`,
        sendSMS: false,
      },
      // Staff
      ...staffMembers.map((s) => ({
        userId: s.userId,
        title: "رزرو جدید",
        body: `رزروی جدید برای سرویس ${service.name} ثبت شد.`,
        sendSMS: false,
      })),
      // Admins
      ...admins.map((a) => ({
        userId: a.id,
        title: "رزرو جدید در سیستم",
        body: `یک رزرو جدید برای سرویس ${service.name} ثبت شد.`,
        sendSMS: false,
      })),
    ];

    // 6️⃣ یکتا کردن Notification ها بر اساس userId
    const uniqueNotifications = notifications.filter(
      (v, i, a) => a.findIndex((t) => t.userId === v.userId) === i,
    );

    // 7️⃣ اضافه کردن به Queue
    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: uniqueNotifications,
      type: NotificationType.BOOKING,
    });

    return {
      success: true,
      message: "رزرو شما با موفقیت ثبت شد",
      bookingId: booking.id,
    };
  } catch (error) {
    await createLog({
      level: "ERROR",
      message: "خطا در ایجاد رزرو",
      context: {
        error: (error as any).message || error,
        params,
        userId: session?.user?.id,
      },
    });
    console.error("Booking Error:", error);
    return { success: false, error: "خطا در ثبت رزرو" };
  }
}

export async function getServiceDetail(serviceId: string) {
  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      await createLog({
        level: "WARN",
        message: "سرویس یافت نشد هنگام دریافت جزئیات",
        context: { serviceId },
      });
      return { success: false, error: "سرویس یافت نشد" };
    }

    return { success: true, service };
  } catch (error) {
    await createLog({
      level: "ERROR",
      message: "خطا در دریافت جزئیات سرویس",
      context: { error: (error as any).message || error, serviceId },
    });
    console.error("get service Error:", error);
    return { success: false, error: "خطا در دریافت سرویس" };
  }
}

type AvailableStaff = {
  id: string;
  name: string;
  avatar: string | null;
};

export async function getAvailableStaffAction(params: {
  businessId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}) {
  const { businessId, serviceId, date, time } = params;

  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true },
    });

    if (!service) throw new Error("Service not found");
    const serviceDuration = service.duration;

    const potentialStart = new Date(`${date}T${time}:00`);
    const potentialEnd = new Date(
      potentialStart.getTime() + serviceDuration * 60000,
    );

    const staffList = await prisma.staffMember.findMany({
      where: {
        businessId: businessId,
        isActive: true,
        deletedAt: null,
        services: { some: { serviceId: serviceId } },
      },
      include: {
        schedules: true,
        exceptions: true,
        bookings: {
          where: {
            status: { in: ["PENDING", "CONFIRMED"] },
            startTime: { lt: potentialEnd },
            endTime: { gt: potentialStart },
          },
          select: { id: true },
        },
      },
    });

    const availableStaff: AvailableStaff[] = [];

    for (const staff of staffList) {
      const isOffToday = staff.exceptions.some(
        (exc) =>
          exc.isClosed &&
          new Date(exc.date).toDateString() === potentialStart.toDateString(),
      );
      if (isOffToday) continue;

      const dayOfWeek = potentialStart.getDay();
      const dbDayOfWeek = (dayOfWeek + 1) % 7;
      const schedule = staff.schedules.find((s) => s.dayOfWeek === dbDayOfWeek);

      if (!schedule || schedule.isClosed) continue;

      const isBooked = staff.bookings.length > 0;
      if (isBooked) continue;

      availableStaff.push({
        id: staff.id,
        name: staff.name,
        avatar: staff.avatar,
      });
    }

    await createLog({
      level: "INFO",
      message: "دریافت لیست پرسنل در دسترس",
      context: {
        businessId,
        serviceId,
        date,
        time,
        availableCount: availableStaff.length,
      },
    });

    return { success: true, data: availableStaff };
  } catch (error) {
    await createLog({
      level: "ERROR",
      message: "خطا در دریافت لیست پرسنل",
      context: { error: (error as any).message || error, params },
    });
    console.error("Get Staff Error:", error);
    return { success: false, error: "خطا در دریافت لیست پرسنل" };
  }
}
