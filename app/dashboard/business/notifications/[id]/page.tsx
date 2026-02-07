// app/notifications/[id]/page.tsx
import GoBackButton from "@/components/GoBackButton/GoBackButton";
import { NotificationType } from "@/constants/enums";
import prisma from "@/utils/prisma";
import {
  Bell,
  Calendar,
  CheckCheck,
  MessageSquare,
  Settings,
} from "lucide-react";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

const getNotificationMeta = (type: NotificationType) => {
  switch (type) {
    case NotificationType.BOOKING:
      return {
        icon: <Calendar size={24} />,
        color: "bg-blue-100 text-blue-600 border-blue-200",
        label: "رزرو",
      };
    case NotificationType.MESSAGE:
      return {
        icon: <MessageSquare size={24} />,
        color: "bg-green-100 text-green-600 border-green-200",
        label: "پیام",
      };
    case NotificationType.SERVICE_CHANGE:
      return {
        icon: <Settings size={24} />,
        color: "bg-orange-100 text-orange-600 border-orange-200",
        label: "تغییر سرویس",
      };
    case NotificationType.SYSTEM:
    default:
      return {
        icon: <Bell size={24} />,
        color: "bg-gray-100 text-gray-600 border-gray-200",
        label: "سیستم",
      };
  }
};

const NotificationDetailPage = async ({ params }: Props) => {
  const { id } = await params;

  // فچ کردن داده از دیتابیس
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
  // اگر اعلان وجود نداشت، صفحه 404 را نمایش بده
  if (!notification) {
    notFound();
  }

  const meta = getNotificationMeta(notification.type as NotificationType);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      {/* ارسال داده به کامپوننت کلاینت */}
      <div className="max-w-2xl mx-auto p-4">
        <GoBackButton />
        {/* هدر کارت */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
              {/* آیکون و بج */}
              <div
                className={`flex items-center gap-3 px-3 py-1.5 rounded-full border ${meta.color} bg-opacity-50`}
              >
                {meta.icon}
                <span className="text-xs font-medium">{meta.label}</span>
              </div>

              {/* وضعیت خواندن */}
              {!notification.isRead && (
                <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  جدید
                </span>
              )}
            </div>

            {/* عنوان و متن */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {notification.title}
            </h1>

            <div className="text-gray-600 leading-relaxed whitespace-pre-line mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
              {notification.body}
            </div>

            {/* تاریخ */}
            <div className="text-sm text-gray-400 mb-8 flex items-center gap-2">
              <span>
                {new Date(notification.createdAt).toLocaleDateString("fa-IR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span>•</span>
              <span>
                {new Date(notification.createdAt).toLocaleTimeString("fa-IR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* دکمه‌های اکشن */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              {notification.isRead && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <CheckCheck size={18} />
                  <span>خوانده شده</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailPage;
