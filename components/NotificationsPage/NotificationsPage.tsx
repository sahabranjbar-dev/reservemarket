"use client";
import { Button } from "@/components/ui/button";
import { NotificationType } from "@/constants/enums";
import { getFullDateTime } from "@/utils/common";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Calendar, CheckCheck, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import NotificationCard from "./_components/NotificationCard";
import { getNotification, markAsReadAction } from "./_meta/actions";

const NotificationsPage = () => {
  const session = useSession();

  const queryClient = useQueryClient();

  const userId = session?.data?.user.id;
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
    staleTime: 60 * 1000, // 1 دقیقه
    refetchOnWindowFocus: true,
    gcTime: 5 * 60 * 1000, // 5 دقیقه
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const result = await markAsReadAction();
      if (!result.success) {
        toast.error(
          result.message || "خطا در علامت‌گذاری اعلان‌ها به عنوان خوانده شده",
        );

        throw new Error(
          result.message || "خطا در علامت‌گذاری اعلان‌ها به عنوان خوانده شده",
        );
      }
      return result;
    },
  });

  const markAsReadHandler = async () => {
    await mutateAsync().then((data) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      toast.success(data.message || "تمام اعلان‌ها خوانده شدند");
    });
  };

  const hasUnreadNotifications = notifications?.some((n) => !n.isRead);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">اعلان‌ها</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            loading={isPending}
            onClick={markAsReadHandler}
            variant="link"
            size="sm"
            className="gap-2"
            rightIcon={<CheckCheck size={12} />}
            disabled={!hasUnreadNotifications}
          >
            علامت‌گذاری همه خوانده شد
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-8 border rounded-2xl p-4">
        {/* Group: Today */}
        <div className="space-y-3">
          <div className="space-y-3">
            {isLoading || isFetching ? (
              <div className="flex justify-center items-center">
                <Loader2 className="animate-spin" />
              </div>
            ) : isError ? (
              <div>
                <AlertCircle size={24} className="text-red-500" />
                <p className="text-red-500 mt-2">
                  {error?.message || "خطا در بارگذاری اعلان‌ها"}
                </p>
              </div>
            ) : notifications?.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500">هیچ اعلانی وجود ندارد</p>
              </div>
            ) : (
              notifications?.map((item) => (
                <NotificationCard
                  color={
                    item.type === NotificationType.BOOKING
                      ? "bg-blue-500"
                      : "bg-green-500"
                  }
                  desc={item.body}
                  read={item.isRead}
                  icon={Calendar}
                  title={item.title}
                  key={item.id}
                  time={getFullDateTime(item.createdAt)}
                  id={item.id}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
