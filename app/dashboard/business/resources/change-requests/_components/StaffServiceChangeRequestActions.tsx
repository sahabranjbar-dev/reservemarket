"use client";
import { Modal } from "@/components";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  Info,
  Loader2,
  MoreVertical,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  approveStaffServiceChangeRequest,
  getStaffServiceChangeRequestDetails,
  rejectStaffServiceChangeRequest,
} from "../_meta/actions";

interface Props {
  id: string;
}

const StaffServiceChangeRequestActions = ({ id }: Props) => {
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: changeRequestDetails,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["staff-service-change-request", id],
    queryFn: async () => {
      const result = await getStaffServiceChangeRequestDetails(id);

      if (!result.success) {
        throw new Error(result.message);
      }
      return result.changeRequest;
    },
    enabled: openModal,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const result = await approveStaffServiceChangeRequest(id);
      if (!result?.success) {
        throw new Error(result?.message || "خطا در تأیید درخواست");
      }
      return result;
    },
    onSuccess: () => {
      toast.success("درخواست با موفقیت تأیید شد");
      queryClient.invalidateQueries({
        queryKey: ["staff-service-change-request", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["staff-service-change-requests"],
      });
      setOpenModal(false);
    },
    onError: (error: Error) => {
      toast.error(`خطا در تأیید درخواست: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { id: string; reason?: string }) => {
      const result = await rejectStaffServiceChangeRequest(
        params.id,
        params.reason,
      );
      if (!result?.success) {
        throw new Error(result?.message || "خطا در رد درخواست");
      }
      return result;
    },
    onSuccess: () => {
      toast.success("درخواست با موفقیت رد شد");
      queryClient.invalidateQueries({
        queryKey: ["staff-service-change-request", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["staff-service-change-requests"],
      });
      setOpenModal(false);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast.error(`خطا در رد درخواست: ${error.message}`);
    },
  });

  const handleApprove = () => {
    if (window.confirm("آیا از تأیید این درخواست اطمینان دارید؟")) {
      approveMutation.mutate();
    }
  };

  const handleReject = () => {
    if (!rejectionReason?.trim()) {
      toast.error("لطفاً دلیل رد درخواست را وارد کنید");
      return;
    }
    if (window.confirm("آیا از رد این درخواست اطمینان دارید؟")) {
      rejectMutation.mutate({ id, reason: rejectionReason });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fa-IR").format(price) + " تومان";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          text: "در انتظار تأیید",
          color: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-50 dark:bg-amber-900/20",
          borderColor: "border-amber-200 dark:border-amber-800",
          icon: Clock,
        };
      case "APPROVED":
        return {
          text: "تأیید شده",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
          icon: CheckCircle,
        };
      case "REJECTED":
        return {
          text: "رد شده",
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          borderColor: "border-red-200 dark:border-red-800",
          icon: XCircle,
        };
      default:
        return {
          text: "نامشخص",
          color: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-50 dark:bg-gray-900/20",
          borderColor: "border-gray-200 dark:border-gray-800",
          icon: AlertCircle,
        };
    }
  };

  const renderComparisonTable = () => {
    if (!changeRequestDetails) return null;

    const currentService = changeRequestDetails.service;
    const requested = changeRequestDetails;

    const fields = [
      {
        label: "نام سرویس",
        current: currentService.name,
        requested: requested.requestedName,
        hasChange: currentService.name !== requested.requestedName,
      },
      {
        label: "قیمت",
        current: currentService?.price
          ? formatPrice(currentService.price)
          : "بدون تغییر",
        requested: requested.requestedPrice
          ? formatPrice(requested.requestedPrice)
          : "بدون تغییر",
        hasChange: currentService.price !== requested.requestedPrice,
      },
      {
        label: "مدت زمان",
        current: `${currentService.duration} دقیقه`,
        requested: requested.requestedDuration
          ? `${requested.requestedDuration} دقیقه`
          : "بدون تغییر",
        hasChange: currentService.duration !== requested.requestedDuration,
      },
      {
        label: "وضعیت فعال",
        current: currentService.isActive ? "فعال" : "غیرفعال",
        requested:
          requested.requestedActive !== null
            ? requested.requestedActive
              ? "فعال"
              : "غیرفعال"
            : "بدون تغییر",
        hasChange:
          currentService.isActive !== requested.requestedActive &&
          requested.requestedActive !== null,
      },
      {
        label: "توضیحات",
        current: currentService.description || "ندارد",
        requested:
          requested.requestedDescription ||
          currentService.description ||
          "بدون تغییر",
        hasChange:
          currentService.description !== requested.requestedDescription &&
          requested.requestedDescription !== null,
      },
    ];

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                فیلد
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                مقدار فعلی
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                مقدار درخواستی
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                وضعیت
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {fields.map((field, index) => (
              <tr
                key={index}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                  {field.label}
                </td>
                <td className="py-3 px-4 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {field.current}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm">
                  <div
                    className={`font-medium ${field.hasChange ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}
                  >
                    {field.requested}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm">
                  {field.hasChange ? (
                    <span className="inline-flex text-nowrap items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
                      تغییر دارد
                    </span>
                  ) : (
                    <span className="inline-flex text-nowrap items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                      بدون تغییر
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStaffInfo = () => {
    if (!changeRequestDetails) return null;

    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
            <User className="h-4 w-4 ml-1" />
            اطلاعات همکار
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            درخواست‌دهنده
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="mr-3">
              <p className="font-medium text-gray-900 dark:text-white">
                {changeRequestDetails.staff.name}
              </p>
              <Link
                href={`tel:${changeRequestDetails.staff.phone}`}
                className="text-xs text-gray-500 dark:text-gray-400 flex justify-start items-center gap-2 my-2"
              >
                <Phone size={12} />
                {changeRequestDetails.staff.phone}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatusBadge = () => {
    if (!changeRequestDetails) return null;

    const statusInfo = getStatusInfo(changeRequestDetails.status);
    const Icon = statusInfo.icon;

    return (
      <div
        className={`inline-flex items-center px-4 py-2 rounded-full ${statusInfo.bgColor} ${statusInfo.borderColor} border`}
      >
        <Icon className={`h-4 w-4 ml-2 ${statusInfo.color}`} />
        <span className={`text-sm font-medium ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
      </div>
    );
  };

  return (
    <>
      <Button
        onClick={() => setOpenModal(true)}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      <Modal
        open={openModal}
        onOpenChange={setOpenModal}
        title={"درخواست تغییر سرویس همکار"}
        hideActions
      >
        {isLoading || isFetching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              در حال دریافت اطلاعات...
            </p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              خطا در دریافت اطلاعات
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {(error as Error).message}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              تلاش مجدد
            </Button>
          </div>
        ) : changeRequestDetails ? (
          <div className="space-y-6">
            {/* اطلاعات کلی */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center mb-2">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-1" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    تاریخ درخواست
                  </span>
                </div>
                <p className="text-gray-900 dark:text-white text-left text-sm">
                  {formatDate(changeRequestDetails.createdAt.toISOString())}
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                <div className="flex items-center mb-2">
                  <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400 ml-1" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    تغییرات قیمت
                  </span>
                </div>
                <p className="text-gray-900 dark:text-white text-left text-sm">
                  {changeRequestDetails.service.price !==
                  changeRequestDetails.requestedPrice
                    ? `${formatPrice(changeRequestDetails.service.price || 0)} → ${formatPrice(changeRequestDetails.requestedPrice || 0)}`
                    : "بدون تغییر"}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center mb-2">
                  <ClipboardCheck className="h-4 w-4 text-green-600 dark:text-green-400 ml-1" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    وضعیت درخواست
                  </span>
                </div>
                <div className="flex justify-end items-center p-2 md:justify-center">
                  {renderStatusBadge()}
                </div>
              </div>
            </div>

            {/* اطلاعات همکار */}
            {renderStaffInfo()}

            {/* جدول مقایسه */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
                  <FileText className="h-4 w-4 ml-1" />
                  مقایسه تغییرات
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  مقایسه مقادیر فعلی با مقادیر درخواستی
                </p>
              </div>
              <div className="p-4">{renderComparisonTable()}</div>
            </div>

            {/* رد شده - نمایش دلیل */}
            {changeRequestDetails.status === "REJECTED" &&
              changeRequestDetails.rejectionReason && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 ml-2" />
                    <div>
                      <h4 className="font-medium text-red-700 dark:text-red-300 mb-1">
                        دلیل رد درخواست
                      </h4>
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {changeRequestDetails.rejectionReason}
                      </p>
                      <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                        بررسی شده در:{" "}
                        {changeRequestDetails.reviewedAt
                          ? formatDate(
                              changeRequestDetails.reviewedAt.toISOString(),
                            )
                          : "نامشخص"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* تأیید شده */}
            {changeRequestDetails.status === "APPROVED" &&
              changeRequestDetails.reviewedAt && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 ml-2" />
                    <div>
                      <h4 className="font-medium text-green-700 dark:text-green-300 mb-1">
                        درخواست تأیید شده
                      </h4>
                      <p className="text-green-600 dark:text-green-400 text-sm">
                        این درخواست در تاریخ{" "}
                        {formatDate(
                          changeRequestDetails.reviewedAt.toISOString(),
                        )}{" "}
                        تأیید شده است.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* اقدامات - فقط برای درخواست‌های در انتظار */}
            {changeRequestDetails.status === "PENDING" && (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 ml-2" />
                    <div>
                      <h4 className="font-medium text-amber-700 dark:text-amber-300 mb-1">
                        نکات مهم
                      </h4>
                      <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1 list-disc pr-4">
                        <li>تغییرات پس از تأیید بلافاصله اعمال می‌شوند</li>
                        <li>
                          برای درخواست‌های رد شده، حتماً دلیل رد را وارد کنید
                        </li>
                        <li>همکار از نتیجه تصمیم شما مطلع خواهد شد</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* فیلد دلیل رد */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      دلیل رد درخواست (در صورت رد)
                    </label>
                    <textarea
                      value={rejectionReason ?? ""}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      placeholder="در صورت رد درخواست، دلیل خود را توضیح دهید..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* دکمه‌های اقدام */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <p>درخواست ID: {changeRequestDetails.id.slice(-8)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setOpenModal(false)}
                        variant="outline"
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                      >
                        انصراف
                      </Button>

                      <Button
                        onClick={handleReject}
                        variant="destructive"
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                        className="flex items-center space-x-2 space-x-reverse"
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span>رد درخواست</span>
                      </Button>

                      <Button
                        onClick={handleApprove}
                        disabled={
                          approveMutation.isPending || rejectMutation.isPending
                        }
                        className="bg-green-600 hover:bg-green-700 flex items-center space-x-2 space-x-reverse"
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        <span>تأیید درخواست</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* برای درخواست‌های تأیید/رد شده */}
            {changeRequestDetails.status !== "PENDING" && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>درخواست ID: {changeRequestDetails.id.slice(-8)}</p>
                  {changeRequestDetails.reviewedAt && (
                    <p className="mt-1">
                      تاریخ بررسی:{" "}
                      {formatDate(
                        changeRequestDetails.reviewedAt.toISOString(),
                      )}
                    </p>
                  )}
                </div>
                <Button onClick={() => setOpenModal(false)} variant="outline">
                  بستن
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default StaffServiceChangeRequestActions;
