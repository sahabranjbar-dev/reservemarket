import { NotificationType } from "@/constants/enums";
import { getFullDateTime } from "@/utils/common";
import prisma from "@/utils/prisma";
import { sendSMS } from "@/utils/sms";

interface INotificationJobItem {
  userId: string;
  title: string;
  body: string;
  sendSMS?: boolean;
  sms?: {
    mobile: string;
    templateId: string;
    parameters: Record<string, string | number>[];
  };
}

interface IData {
  type: NotificationType;
  notifications: INotificationJobItem[];
}

export async function handleCreateNotification(data: IData) {
  const { notifications, type } = data;

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        title: n.title,
        body: n.body,
        type,
      },
    });

    if (n.sendSMS && n.sms) {
      console.log("sms send create");

      // const result = await sendSMS(
      //   n.sms.mobile,
      //   n.sms.templateId,
      //   n.sms.parameters,
      // );

      // if (!result.success) {
      //   throw new Error("SMS sending failed");
      // }
    }
  }
}

export async function handle24hReminder({ bookingId }: { bookingId: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      service: true,
    },
  });

  if (!booking || booking.status !== "CONFIRMED") return;

  await prisma.notification.create({
    data: {
      userId: booking.customerId,
      title: "یادآوری نوبت",
      body: `یادآوری: فردا نوبت شما برای ${booking.service.name} است.`,
      type: "BOOKING",
    },
  });

  // await sendSMS(booking.customer.phone, "BOOKING_REMINDER_24H", [
  //   {
  //     service: booking.service.name,
  //     date: booking.startTime.toLocaleDateString("fa-IR"),
  //   },
  // ]);

  console.log("sms send 24h");
}

export async function handle1hReminder(data: { bookingId: string }) {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: {
      customer: true,
      service: true,
    },
  });

  if (!booking) return;

  // await sendSMS(booking.customer.phone, "REMINDER_1H_TEMPLATE", [
  //   {
  //     service: booking.service.name,
  //     time: getFullDateTime(booking.startTime),
  //   },
  // ]);
  console.log("sms send 1h");
}
