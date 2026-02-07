"use server";

import { createAuditLog } from "@/audit/audit.service";
import { BookingStatus, BusinessRole } from "@/constants/enums";
import { authOptions } from "@/utils/authOptions";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

export async function getStaffBookingsByDate(params: {
  date: string; // YYYY-MM-DD
}) {
  try {
    const { date } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { success: false, error: "لطفاً وارد حساب کاربری شوید" };
    }

    const businessMember = session.user.business;
    if (!businessMember || businessMember.businessRole !== BusinessRole.STAFF) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    const staff = await prisma.staffMember.findFirst({
      where: {
        userId: session.user.id,
        businessId: businessMember.id,
        isActive: true,
      },
    });

    if (!staff) {
      return { success: false, error: "کارمند یافت نشد" };
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        staffId: staff.id,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        deletedAt: null,
      },
      orderBy: { startTime: "asc" },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        service: {
          select: { id: true, name: true, duration: true },
        },
        staff: {
          select: { name: true },
        },
      },
    });

    return { success: true, data: bookings };
  } catch (error) {
    console.error(error);
    return { success: false, error: "خطا در دریافت نوبت‌ها" };
  }
}

export async function getStaffBookingsByRange(params: {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}) {
  try {
    const { startDate, endDate } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { success: false, error: "لطفاً وارد حساب کاربری شوید" };
    }

    const businessMember = session.user.business;
    if (!businessMember || businessMember.businessRole !== BusinessRole.STAFF) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    const staff = await prisma.staffMember.findFirst({
      where: {
        userId: session.user.id,
        businessId: businessMember.id,
        isActive: true,
      },
    });

    if (!staff) {
      return { success: false, error: "کارمند یافت نشد" };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        staffId: staff.id,
        startTime: {
          gte: start,
          lte: end,
        },
        deletedAt: null,
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        service: { select: { name: true } },
        customer: { select: { fullName: true } },
      },
    });

    return { success: true, data: bookings };
  } catch (error) {
    console.error(error);
    return { success: false, error: "خطا در دریافت بازه زمانی" };
  }
}

export async function getStaffBookingDetails(params: { bookingId: string }) {
  try {
    const { bookingId } = params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { success: false, error: "لطفاً وارد حساب کاربری شوید" };
    }

    const businessMember = session.user.business;
    if (!businessMember || businessMember.businessRole !== BusinessRole.STAFF) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    const staff = await prisma.staffMember.findFirst({
      where: {
        userId: session.user.id,
        businessId: businessMember.id,
      },
    });

    if (!staff) {
      return { success: false, error: "کارمند یافت نشد" };
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        staffId: staff.id,
        deletedAt: null,
      },
      include: {
        customer: {
          select: {
            fullName: true,
            phone: true,
          },
        },
        service: {
          select: {
            name: true,
            duration: true,
            price: true,
          },
        },
      },
    });

    if (!booking) {
      return { success: false, error: "نوبت یافت نشد" };
    }

    return { success: true, data: booking };
  } catch (error) {
    console.error(error);
    return { success: false, error: "خطا در دریافت جزئیات نوبت" };
  }
}

const STAFF_ALLOWED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.CANCELED,
  BookingStatus.PENDING,
];

interface Params {
  bookingId: string;
  status: BookingStatus;
}

export async function updateBookingStatusAction({ bookingId, status }: Params) {
  // 1️⃣ ولیدیشن اولیه
  if (!bookingId) {
    return {
      success: false,
      error: "شناسه نوبت معتبر نیست",
    };
  }

  if (!STAFF_ALLOWED_STATUSES.includes(status)) {
    return {
      success: false,
      error: "شما اجازه ثبت این وضعیت را ندارید",
    };
  }

  // 2️⃣ احراز هویت
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      success: false,
      error: "لطفاً دوباره وارد حساب کاربری شوید",
    };
  }

  try {
    // 3️⃣ بررسی مالکیت نوبت (مهم‌ترین بخش امنیت)
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        staffId: session.user.id, // 🔐 فقط نوبت‌های خودش
      },
      select: {
        id: true,
        status: true,
        businessId: true,
      },
    });

    if (!booking) {
      return {
        success: false,
        error: "این نوبت برای شما نیست یا وجود ندارد",
      };
    }

    // 4️⃣ جلوگیری از آپدیت بی‌مورد
    if (booking.status === status) {
      return {
        success: false,
        error: "وضعیت نوبت قبلاً همین بوده است",
      };
    }

    // 5️⃣ آپدیت
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status,
      },
    });

    await createAuditLog({
      action: "BOOKING_STATUS_CHANGED",
      entityType: "BOOKING",
      entityId: booking.id,
      businessId: booking.businessId,
      performedBy: session.user.id,
      actorRole: "STAFF",
      metadata: {
        from: booking.status,
        to: status,
      },
    });

    revalidatePath("/dashboard/staff/bookings");

    return {
      success: true,
      message: "وضعیت نوبت با موفقیت تغییر کرد",
    };
  } catch (error) {
    console.error("updateBookingStatusAction error:", error);

    return {
      success: false,
      error: "خطای غیرمنتظره‌ای رخ داد، لطفاً دوباره تلاش کنید",
    };
  }
}
