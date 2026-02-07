"use server";

import prisma from "@/utils/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";

// -----------------------------
// 1️⃣ ایجاد تیکت جدید توسط مشتری
// -----------------------------
export async function createCustomerTicket(
  userId: string,
  subject: string,
  description: string,
  priority: "LOW" | "MEDIUM" | "HIGH",
) {
  try {
    if (!userId || !subject || !description) {
      return { success: false, message: "لطفاً تمام فیلدها را پر کنید." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          userId,
          subject,
          description,
          priority,
          status: "OPEN",
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "TICKET_CREATED",
          entityType: "TICKET",
          entityId: ticket.id,
          businessId: null, // مشتری است و بیزنس ندارد
          performedBy: userId,
          actorRole: "CUSTOMER",
          metadata: { subject, description, priority },
        },
      });

      return ticket;
    });

    revalidatePath("/dashboard/customer/support");
    return {
      success: true,
      message: "تیکت با موفقیت ثبت شد.",
      ticketId: result.id,
    };
  } catch (error) {
    console.error("Error creating ticket:", error);
    return { success: false, message: "خطا در ثبت تیکت." };
  }
}

// -----------------------------
// 2️⃣ دریافت تیکت‌های اختصاصی مشتری
// -----------------------------
export async function getCustomerTickets(userId: string) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // فقط آخرین پیام را برای پیش‌نمایش می‌گیریم
          include: { ticket: true },
        },
      },
    });

    return { success: true, data: tickets };
  } catch (error) {
    console.error("Error fetching customer tickets:", error);
    return { success: false, message: "خطا در دریافت تیکت‌ها." };
  }
}

// -----------------------------
// 3️⃣ پاسخ به تیکت توسط مشتری
// -----------------------------
export async function replyTicket(
  ticketId: string,
  content: string,
  senderId: string,
) {
  if (!content.trim()) {
    return { success: false, message: "پیام نمی‌تواند خالی باشد." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          ticketId,
          content,
          senderId,
          isAdmin: false, // مشتری است
        },
      });

      // اگر تیکت بسته بود، باز شود
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: "OPEN" },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "TICKET_REPLIED",
          entityType: "TICKET",
          entityId: ticketId,
          businessId: null,
          performedBy: senderId,
          actorRole: "CUSTOMER",
          metadata: { messageId: message.id, content },
        },
      });

      return message;
    });

    revalidatePath("/dashboard/customer/support");
    return { success: true, message: "پاسخ ارسال شد.", messageId: result.id };
  } catch (error) {
    console.error("Error replying to ticket:", error);
    return { success: false, message: "خطا در ارسال پیام." };
  }
}

// -----------------------------
// 4️⃣ دریافت جزئیات یک تیکت خاص برای مشتری
// -----------------------------
export async function getTicket(ticketId: string, userId: string) {
  try {
    if (!ticketId || !userId) {
      return { success: false, message: "دسترسی غیرمجاز یا اطلاعات ناقص است." };
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, userId }, // امنیت: فقط تیکت متعلق به خود مشتری
      include: {
        user: { select: { fullName: true, phone: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { ticket: true } },
      },
    });

    if (!ticket) return { success: false, message: "تیکت یافت نشد." };
    return { success: true, data: ticket };
  } catch (error) {
    console.error("Error fetching ticket details:", error);
    return { success: false, message: "خطا در دریافت اطلاعات تیکت." };
  }
}
