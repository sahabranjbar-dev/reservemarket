"use server";

import { BusinessRole, Role } from "@/constants/enums";
import { convertToEnglishDigits } from "@/utils/common";
import prisma from "@/utils/prisma";
import { revalidatePath } from "next/cache";

// -----------------------------
// 1️⃣ دریافت لیست پرسنل
// -----------------------------
export async function getStaffListAction(businessId: string) {
  try {
    const staff = await prisma.staffMember.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, avatar: true, email: true } } },
    });

    return { success: true, data: staff };
  } catch (error) {
    console.error("Fetch Staff Error:", error);
    return { success: false, error: "خطا در دریافت لیست پرسنل" };
  }
}

// -----------------------------
// 2️⃣ ایجاد پرسنل جدید
// -----------------------------
export async function createStaffAction(
  formData: FormData,
  businessId: string,
  performedBy: string,
) {
  try {
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const resolvedPhone = convertToEnglishDigits(phone);

    if (!name || !resolvedPhone)
      return { success: false, error: "نام و شماره موبایل الزامی است" };

    const staffMember = await prisma.$transaction(async (tx) => {
      // ایجاد یا دریافت کاربر
      const user = await tx.user.upsert({
        where: { phone: resolvedPhone },
        update: {},
        create: {
          phone: resolvedPhone,
          roles: { create: { role: Role.CUSTOMER } },
          fullName: name,
        },
      });

      // چک اینکه قبلاً پرسنل نبوده
      const existingStaff = await tx.staffMember.findFirst({
        where: { businessId, userId: user.id },
      });
      if (existingStaff)
        throw new Error("این پرسنل قبلاً در این کسب‌وکار ثبت شده است.");

      // ایجاد StaffMember
      const staff = await tx.staffMember.create({
        data: { businessId, userId: user.id, name, phone: resolvedPhone },
      });

      // ایجاد BusinessMember
      await tx.businessMember.create({
        data: { userId: user.id, businessId, role: BusinessRole.STAFF },
      });

      // ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: "STAFF_CREATED",
          entityType: "STAFF",
          entityId: staff.id,
          businessId,
          performedBy,
          actorRole: BusinessRole.OWNER,
          metadata: { name, phone: resolvedPhone },
        },
      });

      return staff;
    });

    revalidatePath("/dashboard/business/staff");
    return {
      success: true,
      message: "پرسنل با موفقیت اضافه شد",
      staff: staffMember,
    };
  } catch (error: any) {
    console.error("Create Staff Error:", error);
    return { success: false, error: error.message || "خطا در ایجاد پرسنل" };
  }
}

// -----------------------------
// 3️⃣ ویرایش پرسنل
// -----------------------------
export async function updateStaffAction(
  formData: FormData,
  staffId: string,
  performedBy: string,
) {
  try {
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const resolvedPhone = convertToEnglishDigits(phone);

    if (!name || !resolvedPhone)
      return { success: false, error: "اطلاعات ناقص است" };

    const staff = await prisma.$transaction(async (tx) => {
      const staff = await tx.staffMember.findUnique({ where: { id: staffId } });
      if (!staff) throw new Error("Staff not found");

      // آپدیت StaffMember
      await tx.staffMember.update({
        where: { id: staffId },
        data: { name, phone: resolvedPhone },
      });

      // بررسی یا ایجاد یوزر
      const user = await tx.user.upsert({
        where: { phone: resolvedPhone },
        update: { fullName: name },
        create: {
          phone: resolvedPhone,
          fullName: name,
          roles: { create: { role: Role.CUSTOMER } },
        },
      });

      // اتصال StaffMember به User
      await tx.staffMember.update({
        where: { id: staffId },
        data: { userId: user.id },
      });

      // بررسی BusinessMember
      const existsBusinessMember = await tx.businessMember.findUnique({
        where: {
          userId_businessId: { userId: user.id, businessId: staff.businessId },
        },
      });
      if (!existsBusinessMember) {
        await tx.businessMember.create({
          data: {
            userId: user.id,
            businessId: staff.businessId,
            role: BusinessRole.STAFF,
          },
        });
      }

      // ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: "STAFF_UPDATED",
          entityType: "STAFF",
          entityId: staffId,
          businessId: staff.businessId,
          performedBy,
          actorRole: BusinessRole.OWNER,
          metadata: { name, phone: resolvedPhone },
        },
      });

      return staff;
    });

    revalidatePath("/dashboard/business/staff");
    return {
      success: true,
      message: "اطلاعات پرسنل با موفقیت ویرایش شد",
      staff,
    };
  } catch (error) {
    console.error("Update Staff Error:", error);
    return {
      success: false,
      error: (error as Error).message || "خطا در ویرایش پرسنل",
    };
  }
}

// -----------------------------
// 4️⃣ حذف پرسنل (Soft Delete)
// -----------------------------
export async function deleteStaffAction(staffId: string, performedBy: string) {
  try {
    const staff = await prisma.$transaction(async (tx) => {
      const staff = await tx.staffMember.update({
        where: { id: staffId },
        data: { deletedAt: new Date() },
      });

      // ثبت Audit Log
      await tx.auditLog.create({
        data: {
          action: "STAFF_DELETED",
          entityType: "STAFF",
          entityId: staffId,
          businessId: staff.businessId,
          performedBy,
          actorRole: BusinessRole.OWNER,
          metadata: {},
        },
      });

      return staff;
    });

    revalidatePath("/dashboard/business/staff");
    return { success: true, message: "پرسنل حذف شد", staff };
  } catch (error) {
    console.error("Delete Staff Error:", error);
    return {
      success: false,
      error: (error as Error).message || "خطا در حذف پرسنل",
    };
  }
}
