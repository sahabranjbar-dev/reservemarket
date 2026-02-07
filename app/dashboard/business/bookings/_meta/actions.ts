"use server";

import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import { revalidatePath } from "next/cache";
import { BookingStatus, NotificationType } from "@/constants/enums";
import { createAuditLog } from "@/audit/audit.service";
import { getNotificationContent } from "./utils";
import { notificationQueue } from "@/queues/notification.queue";

export async function updateBookingStatusAction(params: {
  bookingId: string;
  status: BookingStatus;
}) {
  const { bookingId, status } = params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "احراز هویت نشد" };
  }

  try {
    // بررسی اینکه این رزرو متعلق به بیزنس این کاربر است
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        business: {
          ownerId: session.user.id,
        },
      },
    });

    if (!booking) {
      return { success: false, error: "رزرو یافت نشد" };
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      select: {
        service: {
          select: {
            name: true,
          },
        },
        status: true,
        business: {
          select: {
            businessMembers: true,
          },
        },
        customer: {
          select: {
            fullName: true,
            id: true,
            phone: true,
          },
        },
      },
    });

    await createAuditLog({
      action: "BOOKING_STATUS_CHANGED",
      entityType: "BOOKING",
      entityId: booking.id,
      businessId: booking.businessId,
      performedBy: session.user.id,
      actorRole: "OWNER",
      metadata: {
        from: booking.status,
        to: status,
      },
    });

    const { title, body } = getNotificationContent(
      updatedBooking.status as BookingStatus,
      updatedBooking.service.name,
    );

    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: [
        {
          userId: booking.customerId,
          title,
          body,
          sendSMS: true,
        },
        ...updatedBooking.business.businessMembers.map((item) => {
          return {
            userId: item.userId,
            title: "تغییر وضعیت رزرو",
            body: `رزرو برای مشتری ${updatedBooking.customer.fullName || updatedBooking.customer.phone} به وضعیت ${updatedBooking.status} تغییر کرد.`,
            sendSMS: true,
          };
        }),
      ],
      type: NotificationType.BOOKING,
    });

    revalidatePath("/dashboard/business/bookings");

    return { success: true, message: "وضعیت رزرو تغییر کرد" };
  } catch (error) {
    console.error("Update Booking Error:", error);
    return { success: false, error: "خطا در تغییر وضعیت" };
  }
}

export async function getBookingByDate(date: string) {
  try {
    const session = await getServerSession(authOptions);

    // 1. احراز هویت
    if (!session?.user?.id) {
      return {
        success: false,
        error: "لطفاً ابتدا وارد حساب کاربری شوید",
      };
    }

    // 2. بررسی نقش
    if (session.user.business?.businessRole !== "OWNER") {
      return {
        success: false,
        error: "شما دسترسی مشاهده رزروها را ندارید",
      };
    }

    const businessId = session.user.business?.id;

    if (!businessId) {
      return {
        success: false,
        error: "کسب‌وکاری برای این حساب یافت نشد",
      };
    }

    // 3. ساخت بازه روز (00:00 تا 23:59)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 4. دریافت رزروها
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        deletedAt: null,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            duration: true,
          },
        },
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!bookings.length) {
      return {
        success: false,
        error: "در این تاریخ نوبتی وجود ندارد",
      };
    }

    return {
      success: true,
      data: bookings,
    };
  } catch (error) {
    console.error("GET_BOOKINGS_BY_DATE_ERROR:", error);

    return {
      success: false,
      error: "خطا در دریافت رزروها، لطفاً دوباره تلاش کنید",
    };
  }
}

type GetBookingRangeInput =
  | { type: "month"; month: string }
  | { type: "range"; from: string; to: string };

export async function getBookingsByRange(input: GetBookingRangeInput) {
  try {
    const session = await getServerSession(authOptions);

    // 1. احراز هویت
    if (!session?.user?.id) {
      return {
        success: false,
        error: "لطفاً ابتدا وارد حساب کاربری شوید",
      };
    }

    // 2. فقط OWNER
    if (session?.user.business?.businessRole !== "OWNER") {
      return {
        success: false,
        error: "شما دسترسی مشاهده رزروها را ندارید",
      };
    }

    const businessId = session.user.business?.id;

    if (!businessId) {
      return {
        success: false,
        error: "کسب‌وکاری برای این حساب یافت نشد",
      };
    }

    let startDate: Date;
    let endDate: Date;

    // 3. تعیین بازه زمانی
    if (input.type === "month") {
      // مثال: "2026-01"
      if (!/^\d{4}-\d{2}$/.test(input.month)) {
        return {
          success: false,
          error: "فرمت ماه نامعتبر است (مثال صحیح: 2026-01)",
        };
      }

      const [year, month] = input.month.split("-").map(Number);

      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      // range
      const from = new Date(input.from);
      const to = new Date(input.to);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return {
          success: false,
          error: "تاریخ شروع یا پایان نامعتبر است",
        };
      }

      if (from > to) {
        return {
          success: false,
          error: "تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد",
        };
      }

      startDate = from;
      startDate.setHours(0, 0, 0, 0);

      endDate = to;
      endDate.setHours(23, 59, 59, 999);
    }

    // 4. کوئری رزروها
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        deletedAt: null,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            duration: true,
          },
        },
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      data: bookings,
      meta: {
        from: startDate,
        to: endDate,
        total: bookings.length,
      },
    };
  } catch (error) {
    console.error("GET_BOOKINGS_BY_RANGE_ERROR:", error);

    return {
      success: false,
      error: "خطا در دریافت رزروها، لطفاً دوباره تلاش کنید",
    };
  }
}

export async function getBookingDetails(bookingId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "دسترسی ندارید" };
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      deletedAt: null,
      business: {
        ownerId: session.user.id, // امنیت
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          duration: true,
          price: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!booking) {
    return { success: false, error: "رزرو پیدا نشد" };
  }

  return {
    success: true,
    data: booking,
  };
}
