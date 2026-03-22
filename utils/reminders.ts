import { notificationQueue } from "@/queues/notification.queue";

interface IBooking {
  id: string;
  startTime: Date;
}

/**
 * ⏱ Schedule reminders when booking is CONFIRMED
 */
export async function scheduleBookingReminders(booking: IBooking) {
  const bookingTime = new Date(booking.startTime).getTime();
  const now = Date.now();

  const delay24h = bookingTime - now - 24 * 60 * 60 * 1000;
  const delay1h = bookingTime - now - 60 * 60 * 1000;

  if (delay24h > 0) {
    await notificationQueue.add(
      "SEND_REMINDER_24H",
      { bookingId: booking.id },
      {
        delay: delay24h,
        jobId: `booking:${booking.id}:24h`,
      },
    );
  }

  if (delay1h > 0) {
    await notificationQueue.add(
      "SEND_REMINDER_1H",
      { bookingId: booking.id },
      {
        delay: delay1h,
        jobId: `booking:${booking.id}:1h`,
      },
    );
  }
}

/**
 * ❌ Remove reminders when booking is canceled or rescheduled
 */
export async function removeBookingReminders(bookingId: string) {
  const job24h = await notificationQueue.getJob(`booking:${bookingId}:24h`);
  const job1h = await notificationQueue.getJob(`booking:${bookingId}:1h`);

  await job24h?.remove();
  await job1h?.remove();
}
