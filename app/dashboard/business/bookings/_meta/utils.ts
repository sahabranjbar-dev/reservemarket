import { BookingStatus } from "@/constants/enums";

export function getNotificationContent(
  status: BookingStatus,
  serviceName: string,
) {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return {
        title: "رزرو شما تأیید شد ✅",
        body: `رزرو شما برای سرویس ${serviceName} با موفقیت تأیید شد.`,
      };

    case BookingStatus.REJECTED:
      return {
        title: "رزرو شما رد شد ❌",
        body: `متأسفیم، رزرو شما برای سرویس ${serviceName} توسط مدیر رد شد.`,
      };

    case BookingStatus.PENDING:
      return {
        title: "رزرو شما در انتظار بررسی ⏳",
        body: `رزرو شما برای سرویس ${serviceName} در انتظار تایید است.`,
      };

    case BookingStatus.CANCELED:
      return {
        title: "رزرو شما لغو شد ⚠️",
        body: `رزرو شما برای سرویس ${serviceName} لغو شد.`,
      };

    case BookingStatus.COMPLETED:
      return {
        title: "رزرو شما انجام شد 🎉",
        body: `رزرو شما برای سرویس ${serviceName} با موفقیت انجام شد.`,
      };

    case BookingStatus.NO_SHOW_CUSTOMER:
      return {
        title: "مشتری حضور نداشت ❌",
        body: `متأسفیم، شما در زمان رزرو سرویس ${serviceName} حاضر نشدید.`,
      };

    case BookingStatus.NO_SHOW_STAFF:
      return {
        title: "کارمند حضور نداشت ⚠️",
        body: `متأسفیم، کارمند برای سرویس ${serviceName} حاضر نشد.`,
      };

    default:
      return {
        title: "تغییر وضعیت رزرو",
        body: `رزرو شما برای سرویس ${serviceName} به‌روزرسانی شد.`,
      };
  }
}
