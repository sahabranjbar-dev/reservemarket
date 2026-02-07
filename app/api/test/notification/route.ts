import { NextResponse } from "next/server";
import { notificationQueue } from "@/queues/notification.queue";
import { NotificationType } from "@/constants/enums";
import prisma from "@/utils/prisma";

export async function GET() {
  const user = await prisma.user.upsert({
    where: { phone: "09120000000" },
    update: {},
    create: { phone: "09120000000", fullName: "Test User" },
  });

  await notificationQueue.add("CREATE_NOTIFICATION", {
    userId: user.id,
    title: "رزرو جدید",
    body: "رزرو شما با موفقیت ثبت شد.",
    type: NotificationType.BOOKING,
  });

  return NextResponse.json({ success: true });
}
