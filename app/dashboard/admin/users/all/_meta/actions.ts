"use server";

import { Role } from "@/constants/enums";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";

// تعریف تایپ خروجی استاندارد برای اکشن‌ها
type ActionResponse = {
  success: boolean;
  message?: string;
  user?: any; // می‌توانید تایپ دقیق User را از پرایسما ایمپورت کنید
};

// -----------------------------
// 1️⃣ دریافت جزئیات کاربر
// -----------------------------
export async function getUserDetails(id: string): Promise<ActionResponse> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { select: { id: true, role: true } },
        businessMembers: {
          include: {
            business: {
              select: {
                id: true,
                businessName: true,
                businessType: true,
                slug: true,
              },
            },
          },
        },
        ownedBusinesses: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            slug: true,
          },
        },
        bookings: {
          orderBy: { startTime: "desc" },
          take: 20,
          select: {
            id: true,
            startTime: true,
            status: true,
            service: { select: { id: true, name: true } },
            business: { select: { id: true, businessName: true } },
          },
        },
        favorites: {
          select: {
            id: true,
            business: { select: { id: true, businessName: true } },
          },
        },
      },
    });

    if (!user)
      return { success: false, message: "کاربر با این شناسه یافت نشد." };
    return { success: true, user };
  } catch (error) {
    console.error("Error fetching user details:", error);
    return { success: false, message: "خطا در دریافت اطلاعات کاربر از سرور." };
  }
}

// -----------------------------
// 2️⃣ فعال/غیرفعال کردن کاربر
// -----------------------------
export async function toggleUserStatus(id: string): Promise<ActionResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, message: "کاربر یافت نشد." };
    if (user.deletedAt)
      return {
        success: false,
        message: "وضعیت کاربر حذف شده قابل تغییر نیست.",
      };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { isActive: !user.isActive },
      });

      await tx.auditLog.create({
        data: {
          action: "USER_STATUS_TOGGLED",
          entityType: "USER",
          entityId: u.id,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
          metadata: { previousStatus: user.isActive, newStatus: u.isActive },
        },
      });

      return u;
    });

    return {
      success: true,
      message: updated.isActive
        ? "کاربر با موفقیت فعال شد."
        : "کاربر با موفقیت غیرفعال شد.",
    };
  } catch (error) {
    console.error("Error toggling user status:", error);
    return { success: false, message: "خطا در تغییر وضعیت کاربر." };
  }
}

// -----------------------------
// 3️⃣ حذف کاربر (Soft Delete)
// -----------------------------
export async function deleteUser(id: string): Promise<ActionResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, message: "کاربر یافت نشد." };
    if (user.deletedAt)
      return { success: false, message: "این کاربر قبلاً حذف شده است." };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { deletedAt: new Date() } });

      await tx.auditLog.create({
        data: {
          action: "USER_DELETED",
          entityType: "USER",
          entityId: id,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
        },
      });
    });

    return { success: true, message: "کاربر با موفقیت حذف شد." };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, message: "خطا در حذف کاربر." };
  }
}

// -----------------------------
// 4️⃣ بازیابی کاربر
// -----------------------------
export async function restoreUser(id: string): Promise<ActionResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, message: "کاربر یافت نشد." };
    if (!user.deletedAt)
      return { success: false, message: "این کاربر در حال حاضر فعال است." };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { deletedAt: null } });

      await tx.auditLog.create({
        data: {
          action: "USER_RESTORED",
          entityType: "USER",
          entityId: id,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
        },
      });
    });

    return { success: true, message: "کاربر با موفقیت بازیابی شد." };
  } catch (error) {
    console.error("Error restoring user:", error);
    return { success: false, message: "خطا در بازیابی کاربر." };
  }
}

// -----------------------------
// 5️⃣ افزودن نقش به کاربر
// -----------------------------
export async function addUserRole(
  userId: string,
  role: Role,
): Promise<ActionResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  try {
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return { success: false, message: "کاربر یافت نشد." };

    const existingRole = await prisma.userRole.findUnique({
      where: { userId_role: { userId, role } },
    });
    if (existingRole)
      return {
        success: false,
        message: "این نقش قبلاً برای کاربر ثبت شده است.",
      };

    await prisma.$transaction(async (tx) => {
      await tx.userRole.create({ data: { userId, role } });

      await tx.auditLog.create({
        data: {
          action: "USER_ROLE_ADDED",
          entityType: "USER",
          entityId: userId,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
          metadata: { role },
        },
      });
    });

    return { success: true, message: "نقش با موفقیت اضافه شد." };
  } catch (error) {
    console.error("Error adding user role:", error);
    return { success: false, message: "خطا در افزودن نقش." };
  }
}

// -----------------------------
// 6️⃣ حذف نقش از کاربر
// -----------------------------
export async function removeUserRole(
  userId: string,
  roleId: string,
): Promise<ActionResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, message: "دسترسی غیرمجاز" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.delete({ where: { id: roleId } });

      await tx.auditLog.create({
        data: {
          action: "USER_ROLE_REMOVED",
          entityType: "USER",
          entityId: userId,
          businessId: session.user.business?.id ?? "",
          performedBy: session.user.id,
          actorRole: session.user.business?.businessRole ?? "OWNER",
          metadata: { roleId },
        },
      });
    });

    return { success: true, message: "نقش با موفقیت حذف شد." };
  } catch (error) {
    console.error("Error removing user role:", error);
    return { success: false, message: "خطا در حذف نقش." };
  }
}
