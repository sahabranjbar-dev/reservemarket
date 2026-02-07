"use server";

import { authOptions } from "@/utils/authOptions";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";

interface MarkAsReadResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function markAsReadAction(): Promise<MarkAsReadResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { success: false, message: "لطفاً وارد شوید" };
    }

    const userId = session.user.id;

    await prisma.notification.updateMany({
      where: { userId },
      data: { isRead: true },
    });

    return { success: true, message: "تمام اعلان‌ها خوانده شدند" };
  } catch (error) {
    console.error("Error in markAsReadAction:", error);
    return { success: false, error: "خطا در بروزرسانی وضعیت اعلان‌ها" };
  }
}

export async function getNotification() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return { success: false, message: "لطفاً وارد حساب کاربری شوید" };
    }

    const userId = session.user.id;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, notifications };
  } catch (error) {
    console.error(error);

    return { success: false, message: "خطای سرور" };
  }
}
