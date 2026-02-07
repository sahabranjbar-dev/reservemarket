"use client";
import { getNotification } from "@/components/NotificationsPage/_meta/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils"; // فرض بر اینکه از شید‌سی‌ان یا تیل‌وین این را دارید
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

// یک ساختار دمو برای آیتم اعلان
const NotificationItem = ({
  title,
  description,
  time,
  icon: Icon,
  unread = false,
  id,
  activeRole,
}: {
  title: string;
  description: string;
  time: string;
  icon: any;
  unread?: boolean;
  id: string;
  activeRole: string;
}) => (
  <DropdownMenuItem
    className={cn(
      "flex flex-col items-start gap-2 p-4 cursor-pointer focus:bg-slate-50 border-b border-slate-100 last:border-0",
      unread && "bg-indigo-50/30",
    )}
    dir="rtl"
  >
    <Link
      href={`/dashboard/${activeRole}/notifications/${id}`}
      className="flex w-full items-start gap-3"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          unread
            ? "bg-indigo-100 text-indigo-600"
            : "bg-slate-100 text-slate-500",
        )}
      >
        <Icon size={18} />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex justify-between items-start w-full">
          <p
            className={cn(
              "text-sm font-medium leading-none line-clamp-1 truncate overflow-hidden text-ellipsis",
              unread ? "text-slate-900" : "text-slate-600",
            )}
          >
            {title}
          </p>
          {unread && (
            <span className="h-2 w-2 rounded-full bg-indigo-600 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-slate-500 line-clamp-2 text-ellipsis overflow-hidden">
          {description}
        </p>
        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
          {time}
        </span>
      </div>
    </Link>
  </DropdownMenuItem>
);

type UserRoleType = "admin" | "business" | "staff" | "customer";

function getActiveRoleFromPath(pathname: string): UserRoleType {
  const match = pathname.match(/^\/dashboard\/(admin|business|staff)/);
  return (match?.[1] as UserRoleType) ?? "customer";
}

const NotificationButton = () => {
  const session = useSession();

  const userId = session?.data?.user.id;

  const pathname = usePathname();

  const { push } = useRouter();

  const activeRole = getActiveRoleFromPath(pathname);

  const goToNotificationPage = () => {
    push(`/dashboard/${activeRole}/notifications`);
  };

  const {
    data: notifications,
    isLoading,
    isFetching,
    error,
    isError,
  } = useQuery({
    queryFn: async () => {
      const result = await getNotification();

      if (!result.success) {
        toast.error(result.message || "خطا در دریافت اعلان‌ها");

        throw new Error(result.message || "خطا در دریافت اعلان‌ها");
      }
      if (!result.notifications?.length) return [];
      return result.notifications;
    },
    queryKey: ["notifications", userId],
    staleTime: 0,
    refetchOnWindowFocus: true,
    gcTime: 0,
  });

  const hasUnreadNotifications = useMemo(
    () => notifications?.some((n) => !n.isRead),
    [notifications],
  );

  return (
    <>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full hover:bg-slate-100 transition-colors"
          >
            <Bell className="h-5 w-5 text-slate-600 transition-transform group-hover:rotate-12" />

            {hasUnreadNotifications && (
              <span className="absolute top-2.5 end-2.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white"></span>
              </span>
            )}
            <span className="sr-only">اعلان‌ها</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-90 p-0 rounded-2xl shadow-xl shadow-slate-200/50 border-slate-100"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/50 backdrop-blur-sm rounded-t-2xl">
            <DropdownMenuLabel className="text-sm font-bold text-slate-800 px-0 py-0">
              اعلان‌ها
            </DropdownMenuLabel>
          </div>

          <ScrollArea className="h-75">
            <DropdownMenuGroup>
              {hasUnreadNotifications ? (
                isLoading || isFetching ? (
                  <div className="flex items-center justify-center h-74">
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                ) : isError ? (
                  <div className="h-74 flex justify-center items-center">
                    <p className="text-sm font-medium text-red-600 text-center py-4 flex justify-center items-center gap-2">
                      <ShieldAlert size={20} />
                      {error.message || "خطا در بارگذاری اعلان‌ها"}
                    </p>
                  </div>
                ) : (
                  <>
                    {notifications?.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        title={notification.title}
                        description={notification.body}
                        time={new Date(
                          notification.createdAt,
                        ).toLocaleTimeString("fa-IR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        icon={Bell}
                        unread={!notification.isRead}
                        id={notification.id}
                        activeRole={activeRole}
                      />
                    ))}
                  </>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-slate-300">
                    <BellOff size={28} />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    اعلان جدیدی ندارید
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-50">
                    وقتی چیزی جدید اتفاق بیفتد، اینجا به شما اطلاع می‌دهیم.
                  </p>
                </div>
              )}
            </DropdownMenuGroup>
          </ScrollArea>

          <div className="p-2 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
            <DropdownMenuItem
              onClick={goToNotificationPage}
              className="w-full cursor-pointer justify-center text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl h-9 transition-colors"
            >
              مشاهده همه اعلان‌ها
              <ArrowLeft size={14} className="mr-1" />
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default NotificationButton;
