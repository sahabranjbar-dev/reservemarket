"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertToEnglishDigits } from "@/utils/common";
import {
  Edit,
  Loader2,
  MoreVertical,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner"; // یا سیستم ناتیف خودتان
import {
  createStaffAction,
  deleteStaffAction,
  getStaffListAction,
  updateStaffAction,
} from "../_meta/actions";
import { useConfirm } from "@/hooks/useConfirm";
import { useSession } from "next-auth/react";

// تایپ برای داده پرسنل
type StaffMember = {
  id: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  createdAt: Date;
  user?: {
    avatar: string | null;
  } | null;
};

interface StaffPageProps {
  businessId: string;
  initialStaff: any;
}

const StaffPage = ({ businessId, initialStaff }: StaffPageProps) => {
  const session = useSession();

  const confirm = useConfirm();
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [isPending, startTransition] = useTransition();

  // مودال
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // فرم
  const [formData, setFormData] = useState({ name: "", phone: "" });

  // باز کردن مودال برای افزودن
  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setFormData({ name: "", phone: "" });
    setIsModalOpen(true);
  };

  // باز کردن مودال برای ویرایش
  const handleOpenEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({ name: staff.name, phone: staff.phone ?? "" });
    setIsModalOpen(true);
  };

  // بستن مودال
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
  };

  // ذخیره (ایجاد یا ویرایش)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const form = new FormData();
    form.append("name", formData.name);
    form.append("phone", convertToEnglishDigits(formData.phone));

    startTransition(async () => {
      if (!session.data?.user.id) return;
      let res;
      if (editingStaff) {
        // ویرایش
        res = await updateStaffAction(
          form,
          editingStaff.id,
          session.data?.user.id,
        );
      } else {
        // ایجاد
        res = await createStaffAction(form, businessId, session.data?.user.id);
      }

      if (res.success) {
        toast.success(res.message);
        // آپدیت کردن لیست لوکال برای جلوگیری از رفرش صفحه (Optimistic Update)
        if (editingStaff) {
          setStaffList((prev) =>
            prev.map((s) =>
              s.id === editingStaff.id ? { ...s, ...formData } : s,
            ),
          );
        } else {
          // در حالت ایجاد، برای سادگی فعلاً کل لیست را رفرش می‌کنیم
          // یا می‌توانیم به سمت API مجدداً درخواست بزنیم
          const refreshRes = await getStaffListAction(businessId);
          if (refreshRes.success && refreshRes.data)
            setStaffList(refreshRes.data);
        }
        handleCloseModal();
      } else {
        toast.error(res.error);
      }
    });
  };

  // حذف پرسنل
  const handleDelete = (id: string) => {
    confirm({ description: "آیا از حذف این پرسنل اطمینان دارید؟" }).then(
      (value) => {
        if (!value) return;
        startTransition(async () => {
          if (!session.data?.user.id) return;
          const res = await deleteStaffAction(id, session.data?.user.id);
          if (res.success) {
            toast.success(res.message);
            setStaffList((prev) => prev.filter((s) => s.id !== id));
          } else {
            toast.error(res.error);
          }
        });
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* هدر صفحه */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">مدیریت پرسنل</h1>
          <p className="text-slate-500 text-sm mt-1">
            لیست تمام پرسنل و کارمندان مجموعه شما
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleOpenAddModal}
              className="gap-2 shadow-lg shadow-indigo-100"
            >
              <UserPlus className="w-4 h-4" />
              افزودن پرسنل جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? "ویرایش اطلاعات" : "افزودن پرسنل جدید"}
              </DialogTitle>
              <DialogDescription>
                اطلاعات تماس و شناسه‌ای پرسنل را وارد کنید.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  نام و نام خانوادگی <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="مثال: علی محمدی"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  شماره موبایل <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="0912..."
                  disabled={isPending}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={isPending}
                >
                  انصراف
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "ذخیره"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* لیست پرسنل */}
      {staffList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-900">هنوز پرسنلی ثبت نشده است</h3>
          <p className="text-slate-500 text-sm mt-1">
            برای شروع کار، اولین پرسنل خود را اضافه کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {staffList.map((staff) => {
            return (
              <div
                key={staff.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-slate-50">
                      <AvatarImage
                        src={staff.avatar || staff.user?.avatar || undefined}
                        alt={staff.name}
                      />
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">
                        {staff.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-slate-900">{staff.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{staff.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* منوی سه نقطه */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleOpenEditModal(staff)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        ویرایش
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(staff.id)}
                        className="text-red-600 focus:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* اطلاعات اضافی (مثلا تاریخ عضویت یا نقش) */}
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-xs text-slate-400">
                    عضویت:{" "}
                    {new Date(staff.createdAt).toLocaleDateString("fa-IR")}
                  </span>
                  {staff.user ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] gap-1 px-2 py-0 h-5 bg-green-50 text-green-700 border-green-200"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      اکانت فعال
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0 h-5 border-dashed text-slate-400"
                    >
                      بدون اکانت
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffPage;
