"use server";

import prisma from "@/utils/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";

// -----------------------------
// 1️⃣ دریافت لیست تیکت‌ها
// -----------------------------
export async function getTickets() {
  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { fullName: true, phone: true, email: true, avatar: true },
        },
      },
    });

    return { success: true, data: tickets };
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return { success: false, message: "خطا در دریافت لیست تیکت‌ها." };
  }
}

// -----------------------------
// 2️⃣ دریافت جزئیات یک تیکت
// -----------------------------
export async function getTicket(id: string) {
  try {
    if (!id) return { success: false, message: "آیدی تیکت الزامی است." };

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: { fullName: true, phone: true, email: true, avatar: true },
        },
        messages: {
          include: { ticket: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) return { success: false, message: "تیکت یافت نشد." };

    return { success: true, data: ticket };
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return { success: false, message: "خطا در دریافت اطلاعات تیکت." };
  }
}

// -----------------------------
// 3️⃣ پاسخ به تیکت
// -----------------------------
export async function replyToTicket(
  ticketId: string,
  content: string,
  senderId: string,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  if (!ticketId || !content.trim()) {
    return { success: false, message: "لطفاً متن پاسخ را وارد کنید." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. ثبت پیام پاسخ
      const message = await tx.ticketMessage.create({
        data: {
          ticketId,
          content,
          senderId,
          isAdmin: true,
        },
      });

      // 2. تغییر وضعیت تیکت اگر بسته بود -> باز شود
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (ticket && ticket.status === "CLOSED") {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: "OPEN" },
        });
      }

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          action: "TICKET_REPLIED",
          entityType: "TICKET",
          entityId: ticketId,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
          metadata: { messageId: message.id, content },
        },
      });

      return message;
    });

    // 4. بروزرسانی کش
    revalidatePath("/dashboard/admin/support-tickets");
    revalidatePath(`/dashboard/admin/support-tickets/${ticketId}`);

    return { success: true, message: "پاسخ ثبت شد.", messageId: result.id };
  } catch (error) {
    console.error("Error replying to ticket:", error);
    return { success: false, message: "خطا در ثبت پاسخ." };
  }
}

// -----------------------------
// 4️⃣ تغییر وضعیت تیکت
// -----------------------------
export async function updateTicketStatus(
  ticketId: string,
  status: "OPEN" | "PENDING" | "CLOSED",
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  try {
    await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status, closedAt: status === "CLOSED" ? new Date() : null },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "TICKET_STATUS_UPDATED",
          entityType: "TICKET",
          entityId: ticketId,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
          metadata: { newStatus: status },
        },
      });
    });

    revalidatePath("/dashboard/admin/support-tickets");
    return { success: true, message: "وضعیت تیکت تغییر کرد." };
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return { success: false, message: "خطا در تغییر وضعیت." };
  }
}
