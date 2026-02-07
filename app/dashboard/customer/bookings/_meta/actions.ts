"use server";

import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { revalidatePath } from "next/cache";
import { notificationQueue } from "@/queues/notification.queue";
import { NotificationType } from "@/constants/enums";

export async function getAvailableSlotsAction(params: {
  businessId: string;
  serviceId: string;
  date: string; // فرمت YYYY-MM-DD
}) {
  const { businessId, serviceId, date } = params;

  try {
    // 1. دریافت اطلاعات سرویس
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true, staff: true },
    });

    if (!service) throw new Error("Service not found");

    // 2. دریافت پرسنل فعال مرتبط
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
            startTime: {
              gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
              lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          select: { startTime: true, endTime: true },
        },
      },
    });

    if (staffList.length === 0) {
      return { success: true, slots: [] };
    }

    const globalSlots: { [key: string]: number } = {};

    // ساعت‌های کاری پیش‌فرض سیستم (می‌توانید از تنظیمات بیزنس هم بخوانید)
    const START_HOUR = 8;
    const END_HOUR = 22;
    const SLOT_INTERVAL = 30;

    // تبدیل تاریخ ورودی به شمسی برای نمایش یا منطق داخلی اگر نیاز بود (اینجا از گریگوری استفاده می‌کنیم برای محاسبه)
    const dateObj = new Date(date);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const isToday = date === todayStr;
    // --- FIX: تبدیل روز هفته جاوااسکریپت به دیتابیس ---
    // JS: Sun=0, Mon=1, ..., Sat=6
    // DB:  Sat=0, Sun=1, ..., Fri=6
    const jsDayOfWeek = dateObj.getDay();
    const dbDayOfWeek = (jsDayOfWeek + 1) % 7;

    for (const staff of staffList) {
      // الف) بررسی تعطیلی روزانه (StaffException)
      // نرمال‌سازی تاریخ به رشته برای مقایسه ایمن
      const serviceDuration = service.duration;
      const staffBreak = staff.breakMinutes || 0;

      const totalSlotDuration = serviceDuration + staffBreak;

      const exceptionDateStr = dateObj.toISOString().split("T")[0];

      const isOffToday = staff.exceptions.some((exc) => {
        const excDateStr = new Date(exc.date).toISOString().split("T")[0];
        return exc.isClosed && excDateStr === exceptionDateStr;
      });

      const timeExceptions = staff.exceptions.filter((exc) => {
        const excDateStr = new Date(exc.date).toISOString().split("T")[0];
        return (
          !exc.isClosed &&
          excDateStr === exceptionDateStr &&
          exc.startTime &&
          exc.endTime
        );
      });

      if (isOffToday) continue;

      // ب) پیدا کردن شیفت امروز پرسنل
      const schedule = staff.schedules.find((s) => s.dayOfWeek === dbDayOfWeek);

      if (!schedule || schedule.isClosed) continue;

      // محدوده شیفت
      const [shiftStartH, shiftStartM] = schedule.startTime
        .split(":")
        .map(Number);
      const [shiftEndH, shiftEndM] = schedule.endTime.split(":").map(Number);

      const shiftStartMin = shiftStartH * 60 + shiftStartM;
      const shiftEndMin = shiftEndH * 60 + shiftEndM;

      // ج) تولید اسلات‌ها
      for (
        let timeMin = shiftStartMin;
        timeMin + totalSlotDuration <= shiftEndMin;
        timeMin += SLOT_INTERVAL
      ) {
        const slotTimeString = `${String(Math.floor(timeMin / 60)).padStart(
          2,
          "0",
        )}:${String(timeMin % 60).padStart(2, "0")}`;

        const potentialStart = new Date(`${date}T${slotTimeString}:00`);
        const potentialEnd = new Date(
          potentialStart.getTime() + totalSlotDuration * 60000,
        );

        if (isToday && potentialStart <= now) {
          continue;
        }

        if (isInTimeException(potentialStart, potentialEnd, timeExceptions)) {
          continue;
        }

        const isBooked = staff.bookings.some((booking) => {
          const existingStart = new Date(booking.startTime);
          const existingEnd = new Date(booking.endTime);
          return potentialStart < existingEnd && potentialEnd > existingStart;
        });

        if (!isBooked) {
          globalSlots[slotTimeString] = (globalSlots[slotTimeString] || 0) + 1;
        }
      }
    }

    const sortedSlots = Object.entries(globalSlots)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({
        time,
        status: "available" as const,
        staffCount: count,
      }));

    return { success: true, slots: sortedSlots };
  } catch (error) {
    console.error("Get Slots Error:", error);
    return { success: false, error: "خطا در محاسبه زمان‌ها" };
  }
}

const isInTimeException = (start: Date, end: Date, exceptions: any) => {
  return exceptions.some((exc: any) => {
    const [sh, sm] = exc.startTime!.split(":").map(Number);
    const [eh, em] = exc.endTime!.split(":").map(Number);

    const excStart = new Date(start);
    excStart.setHours(sh, sm, 0, 0);

    const excEnd = new Date(start);
    excEnd.setHours(eh, em, 0, 0);

    // overlap check
    return start < excEnd && end > excStart;
  });
};

export async function updateBookingAction(params: {
  bookingId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}) {
  const { bookingId, date, time } = params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "لطفاً ابتدا وارد شوید" };
  }

  try {
    // 1️⃣ دریافت رزرو فعلی
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { duration: true } },
        staff: true,
      },
    });

    if (!booking) {
      return { success: false, error: "رزرو یافت نشد" };
    }

    // فقط صاحب رزرو اجازه تغییر دارد
    if (booking.customerId !== session.user.id) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    const { businessId, serviceId, staffId } = booking;
    const serviceDuration = booking.service.duration;

    // 2️⃣ ساخت زمان‌ها (timezone-safe)
    const [h, m] = time.split(":").map(Number);
    const startDate = new Date(`${date}T00:00:00`);
    startDate.setHours(h, m, 0, 0);

    const endDate = new Date(startDate.getTime() + serviceDuration * 60000);

    // 3️⃣ بررسی تداخل رزرو (به جز خود رزرو)
    const conflict = await prisma.booking.findFirst({
      where: {
        id: { not: bookingId },
        staffId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { lt: endDate },
        endTime: { gt: startDate },
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        success: false,
        error: "این زمان قبلاً رزرو شده است، لطفاً زمان دیگری انتخاب کنید",
      };
    }

    // 4️⃣ آپدیت رزرو
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: startDate,
        endTime: endDate,
        status: "PENDING", // بعد از تغییر نیاز به تأیید مجدد
      },
      include: {
        business: {
          select: {
            businessMembers: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            fullName: true,
            phone: true,
          },
        },
      },
    });

    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: [
        ...updatedBooking.business.businessMembers.map((item) => {
          return {
            userId: item.userId,
            title: "رزرو توسط مشتری تغییر کرد",
            body: `رزرو برای سرویس ${updatedBooking.service.name} توسط ${updatedBooking.customer.fullName || updatedBooking.customer.phone} تغییر کرد.`,
            sendSMS: true,
          };
        }),
      ],
      type: NotificationType.BOOKING,
    });

    // log and send sms to owner and staffs

    revalidatePath(`/business/${businessId}`);
    revalidatePath("/dashboard/bookings");

    return {
      success: true,
      message: "زمان رزرو با موفقیت تغییر کرد",
      bookingId: updatedBooking.id,
    };
  } catch (error) {
    console.error("Update Booking Error:", error);
    return { success: false, error: "خطا در تغییر زمان رزرو" };
  }
}

interface CancelBookingParams {
  bookingId: string;
  reason: string;
}

export async function cancelBookingAction({
  bookingId,
  reason,
}: CancelBookingParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "لطفاً ابتدا وارد شوید" };
  }

  try {
    // 1. پیدا کردن رزرو
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, error: "رزرو یافت نشد" };
    }

    // فقط صاحب رزرو اجازه تغییر دارد
    if (booking.customerId !== session.user.id) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    // 2. به‌روزرسانی رزرو
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: reason,
      },
      include: {
        business: {
          select: {
            businessMembers: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            phone: true,
            fullName: true,
          },
        },
      },
    });

    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: [
        ...updatedBooking.business.businessMembers.map((item) => {
          return {
            userId: item.userId,
            title: "رزرو توسط مشتری لغو شد",
            body: `رزرو برای سرویس ${updatedBooking.service.name} توسط ${updatedBooking.customer.fullName || updatedBooking.customer.phone} لغو شد.`,
            sendSMS: true,
          };
        }),
      ],
      type: NotificationType.BOOKING,
    });

    return { success: true, message: "رزرو با موفقیت لغو شد" };
  } catch (error) {
    console.error("Cancel Booking Error:", error);
    return { success: false, error: "خطا در لغو رزرو" };
  }
}
