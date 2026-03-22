"use server";

import { createAuditLog } from "@/audit/audit.service";
import {
  BusinessRegistrationStatus,
  BusinessRole,
  BusinessType,
  NotificationType,
  Role,
} from "@/constants/enums";
import { notificationQueue } from "@/queues/notification.queue";
import { authOptions } from "@/utils/authOptions";
import { convertToEnglishDigits } from "@/utils/common";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

// تایپ‌ها
export enum BusinessStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface BusinessActionResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function approveBusiness(
  businessId: string,
): Promise<BusinessActionResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.roles.includes(Role.SUPER_ADMIN)) {
      return {
        success: false,
        message: "دسترسی ندارید",
      };
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { owner: true },
    });

    if (!business) {
      return {
        success: false,
        message: "کسب‌وکار یافت نشد",
      };
    }

    if (business.registrationStatus === BusinessStatus.APPROVED) {
      return {
        success: false,
        message: "این کسب‌وکار قبلاً تایید شده است",
      };
    }

    const updatedBusiness = await prisma.$transaction(async (tx) => {
      const updated = await tx.business.update({
        where: { id: businessId },
        data: {
          registrationStatus: BusinessStatus.APPROVED,
          rejectionReason: null,
          activatedAt: new Date(),
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "BUSINESS_APPROVED",
          entityType: "BUSINESS",
          entityId: business.id,
          businessId: business.id,
          performedBy: session.user.id,
          actorRole: Role.SUPER_ADMIN,
          metadata: {
            from: business.registrationStatus,
            to: BusinessStatus.APPROVED,
          },
        },
      });

      return updated;
    });

    const admins = await prisma.user.findMany({
      where: {
        roles: {
          every: {
            role: "SUPER_ADMIN",
          },
        },
      },
    });

    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: [
        {
          userId: updatedBusiness.ownerId,
          title: "کسب‌وکار شما تائید شد",
          body: `${updatedBusiness.ownerName} کسب‌وکار شما با نام ${updatedBusiness.businessName} تایید شد.`,
          sendSMS: true,
        },
        ...admins.map((item) => ({
          userId: item.id,
          title: "کسب‌وکار جدید تائید شد",
          body: `کسب‌وکار جدید با نام ${updatedBusiness.businessName} تائید شد`,
          sendSMS: false,
        })),
      ],
      type: NotificationType.SYSTEM,
    });

    revalidatePath("/admin/dashboard/businesses");

    return {
      success: true,
      message: "کسب‌وکار با موفقیت تایید شد و کاربر مطلع گردید.",
    };
  } catch (error) {
    console.error("Error approving business:", error);
    return {
      success: false,
      message: "خطا در تایید کسب‌وکار",
    };
  }
}

export async function rejectBusiness(businessId: string, reason: string) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.roles.includes(Role.SUPER_ADMIN)) {
      return {
        success: false,
        message: "دسترسی ندارید",
        error: "ادمین میتواند کسب‌‌وکار را رد کند",
      };
    }
    if (!reason.trim()) {
      return { success: false, message: "دلیل رد کردن الزامی است." };
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { owner: true },
    });

    if (!business) {
      return { success: false, message: "کسب‌وکار یافت نشد" };
    }

    if (business.registrationStatus === BusinessStatus.REJECTED) {
      return { success: false, message: "این کسب‌وکار قبلاً رد شده است" };
    }

    // 1. آپدیت در دیتابیس
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        registrationStatus: BusinessStatus.REJECTED,
        rejectionReason: reason,
        activatedAt: null,
        isActive: false,
        rejectedAt: new Date(),
      },
      include: { owner: true },
    });

    await createAuditLog({
      action: "BUSINESS_REJECTED",
      entityType: "BUSINESS",
      entityId: business.id,
      businessId: business.id,
      performedBy: session.user.id,
      actorRole: Role.SUPER_ADMIN,
      metadata: {
        from: business.registrationStatus,
        to: BusinessStatus.REJECTED,
        reason,
      },
    });

    const admins = await prisma.user.findMany({
      where: {
        roles: {
          every: {
            role: "SUPER_ADMIN",
          },
        },
      },
    });

    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: [
        {
          userId: updatedBusiness.ownerId,
          title: "کسب‌وکار شما رد شد",
          body: `${updatedBusiness.ownerName} کسب‌وکار شما با نام ${updatedBusiness.businessName} رد شد.`,
          sendSMS: true,
        },
        ...admins.map((item) => ({
          userId: item.id,
          title: "کسب‌وکار جدید رد شد",
          body: `کسب‌وکار جدید با نام ${updatedBusiness.businessName} رد شد`,
          sendSMS: false,
        })),
      ],
      type: NotificationType.SYSTEM,
    });

    // 3. بروزرسانی کش
    revalidatePath("/admin/dashboard/businesses");

    return {
      success: true,
      updatedBusiness,
      message: "درخواست رد شد و کاربر مطلع گردید.",
    };
  } catch (error) {
    console.error("Error rejecting business:", error);
    return {
      success: false,
      message: "خطا در رد کردن کسب و کار",
      error: String(error),
    };
  }
}
export async function toggleBusinessStatus(id: string, isActive: boolean) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return { success: false, error: "احراز هویت نشده" };
    }

    const isSuperAdmin = session.user.roles?.includes(Role.SUPER_ADMIN);
    if (!isSuperAdmin) {
      return { success: false, error: "دسترسی غیرمجاز" };
    }

    // 1️⃣ آپدیت بیزنس
    const updatedBusiness = await prisma.business.update({
      where: { id },
      data: { isActive: !isActive },
    });

    // 2️⃣ AuditLog (بعد از موفقیت)
    await createAuditLog({
      action: "BUSINESS_STATUS_CHANGED",
      entityType: "BUSINESS",
      entityId: updatedBusiness.id,
      businessId: updatedBusiness.id,
      performedBy: session.user.id,
      actorRole: Role.SUPER_ADMIN,
      metadata: {
        from: isActive,
        to: updatedBusiness.isActive,
      },
    });

    const admins = await prisma.user.findMany({
      where: {
        roles: {
          every: {
            role: "SUPER_ADMIN",
          },
        },
      },
    });

    await notificationQueue.add("CREATE_NOTIFICATION", {
      notifications: [
        {
          userId: updatedBusiness.ownerId,
          title: `کسب‌وکار شما ${updatedBusiness.isActive ? "فعال" : "غیر فعال"} شد`,
          body: `${updatedBusiness.ownerName} وضعیت کسب‌وکار شما با نام ${updatedBusiness.businessName} ${updatedBusiness.isActive ? "فعال" : "غیر فعال"} شد`,
          sendSMS: true,
        },
        ...admins.map((item) => ({
          userId: item.id,
          title: `کسب‌وکار جدید ${updatedBusiness.isActive ? "فعال" : "غیر فعال"} شد`,
          body: `کسب‌وکار جدید با نام ${updatedBusiness.businessName} ${updatedBusiness.isActive ? "فعال" : "غیر فعال"} شد`,
          sendSMS: false,
        })),
      ],
      type: NotificationType.SYSTEM,
    });

    revalidatePath("/dashboard/admin/businesses");

    return {
      success: true,
      message: `کسب‌وکار ${updatedBusiness.isActive ? "فعال" : "غیرفعال"} شد`,
    };
  } catch (error) {
    console.error("Toggle Business Status Error:", error);
    return { success: false, error: "خطا در تغییر وضعیت" };
  }
}

export async function getBusinessDetail(id: string) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.roles.includes(Role.SUPER_ADMIN)) {
      return {
        success: false,
        message: "دسترسی ندارید",
      };
    }

    if (!id) {
      return { success: false, message: "آیدی الزامی است" };
    }

    const businessDetail = await prisma.business.findUnique({
      where: { id },
      include: {
        owner: true,
      },
    });

    if (!businessDetail) {
      return { success: false, message: "اطلاعات کسب‌وکار یافت نشد" };
    }

    return { success: true, businessDetail };
  } catch (error) {
    console.error("Error getting business data:", error);
    return {
      success: false,
      message: "خطا در دریافت اطلاعات کسب‌وکار",
    };
  }
}

interface IData {
  id: string;
  businessName: string;
  ownerName: string;
  identifier: string;
  businessType: BusinessType;
  registrationStatus: BusinessRegistrationStatus;
  description: string;
  address: string;
  rejectionReason: string;
}

export async function updateBusiness({
  id,
  businessName,
  ownerName,
  identifier,
  businessType,
  address,
  description,
  registrationStatus,
  rejectionReason,
}: IData) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.roles.includes(Role.SUPER_ADMIN)) {
      return {
        success: false,
        message: "دسترسی ندارید",
      };
    }

    if (!id) {
      return { success: false, message: "آیدی الزامی است" };
    }

    const existIdentifier = await prisma.business.findFirst({
      where: {
        identifier: {
          equals: identifier,
          mode: "insensitive",
        },
        id: { not: id },
      },
    });

    if (existIdentifier) {
      return {
        success: false,
        message: "این شناسه توسط یک کسب‌وکار دیگر انتخاب شده",
      };
    }

    const updateBusiness = await prisma.business.update({
      where: { id },
      data: {
        address,
        businessType,
        businessName,
        description,
        identifier: identifier.trim(),
        ownerName,
        registrationStatus,
        rejectionReason,
        activatedAt:
          registrationStatus === BusinessRegistrationStatus.APPROVED
            ? new Date()
            : null,
        rejectedAt:
          registrationStatus === BusinessRegistrationStatus.REJECTED
            ? new Date()
            : null,
      },
    });

    revalidatePath(`/dashboard/admin/businesses/${id}`);
    revalidatePath(`/dashboard/admin/businesses`);
    return { success: true, updateBusiness };
  } catch (error) {
    console.error("Error update business:", error);
    return {
      success: false,
      message: "خطا در ویرایش اطلاعات کسب‌وکار",
    };
  }
}

export async function getBusinessStaff(businessId: string) {
  try {
    if (!businessId) {
      return { success: false, message: "id is required" };
    }
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return { success: false, message: "Unauthorized" };
    }

    if (!session.user.roles.includes(Role.SUPER_ADMIN)) {
      return { success: false, message: "Access denied" };
    }

    const page = 1;
    const pageSize = 10;

    const where = {
      businessId,
      deletedAt: null,
    };

    const staffMember = await prisma.staffMember.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
        business: {
          select: {
            id: true,
            businessName: true,
          },
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                staff: true,
              },
            },
          },
        },
      },
    });

    const resultList = staffMember.map((item, index) => ({
      ...item,
      rowNumber: (page - 1) * pageSize + index + 1,
    }));

    const totalItems = await prisma.staffMember.count({
      where,
    });

    const data = {
      resultList,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };

    return { success: true, data };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Server error" };
  }
}
interface IUsertData {
  businessId: string;
  staffPhone: string;
  staffName: string;
  staffMemberId?: string;
}

export async function upsertStaff({
  businessId,
  staffPhone,
  staffName,
  staffMemberId,
}: IUsertData) {
  try {
    return await prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new Error("BUSINESS_NOT_FOUND");
      }

      const phone = convertToEnglishDigits(staffPhone);

      // 1️⃣ UPSERT USER (by phone)
      const user = await tx.user.upsert({
        where: { phone },
        update: {
          fullName: staffName,
        },
        create: {
          phone,
          fullName: staffName,
          roles: {
            create: { role: "CUSTOMER" },
          },
        },
      });

      // 2️⃣ STAFF MEMBER
      let staffMember;

      if (staffMemberId) {
        staffMember = await tx.staffMember.update({
          where: { id: staffMemberId },
          data: {
            name: staffName,
            phone,
            userId: user.id,
          },
        });
      } else {
        staffMember = await tx.staffMember.create({
          data: {
            name: staffName,
            phone,
            businessId,
            userId: user.id,
          },
        });
      }

      // 3️⃣ BUSINESS MEMBER (idempotent)
      await tx.businessMember.upsert({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          businessId,
          role: BusinessRole.STAFF,
        },
      });

      return {
        success: true,
        message: staffMemberId
          ? "ویرایش همکار با موفقیت انجام شد"
          : "افزودن همکار با موفقیت انجام شد",
      };
    });
  } catch (error) {
    console.error(error);
    return { success: false, message: "Server error" };
  }
}

interface IDeleteStaffInput {
  staffMemberId: string;
}

export async function deleteStaffByAdmin({ staffMemberId }: IDeleteStaffInput) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return { success: false, message: "UNAUTHORIZED" };
    }

    const isAdmin = session.user.roles?.some((r) => r === Role.SUPER_ADMIN);

    if (!isAdmin) {
      return { success: false, message: "FORBIDDEN" };
    }

    return await prisma.$transaction(async (tx) => {
      const staff = await tx.staffMember.findUnique({
        where: { id: staffMemberId },
        include: {
          user: {
            include: {
              businessMembers: true,
              roles: true,
            },
          },
        },
      });

      if (!staff) {
        return { success: false, message: "STAFF_NOT_FOUND" };
      }

      const userId = staff.userId;

      if (!userId) {
        return { success: false, message: "user id not found" };
      }
      // 1️⃣ حذف staffMember
      await tx.staffMember.delete({
        where: { id: staffMemberId },
      });

      // 2️⃣ حذف عضویت کسب‌وکار
      await tx.businessMember.deleteMany({
        where: {
          userId,
          businessId: staff.businessId,
        },
      });

      // 3️⃣ اگر User هیچ وابستگی‌ای نداشت → حذف User
      const remainingMemberships = await tx.businessMember.count({
        where: { userId },
      });

      const hasImportantRole = staff.user?.roles.some(
        (r) => r.role === Role.SUPER_ADMIN,
      );

      if (remainingMemberships === 0 && !hasImportantRole) {
        await tx.user.delete({
          where: { id: userId },
        });
      }

      return {
        success: true,
        message: "همکار با موفقیت حذف شد",
      };
    });
  } catch (error: any) {
    console.error(error);

    return {
      success: false,
      message: error.message === "FORBIDDEN" ? "دسترسی غیرمجاز" : "خطای سرور",
    };
  }
}
