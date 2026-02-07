"use server";

import { getServerSession } from "next-auth";
import prisma from "@/utils/prisma";
import { authOptions } from "@/utils/authOptions";
import { BusinessRole } from "@/constants/enums";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// -----------------------------
// 1️⃣ به‌روزرسانی تنظیمات کسب‌وکار
// -----------------------------
const updateBusinessSchema = z.object({
  ownerName: z.string().min(2, "نام مالک الزامی است"),
  businessName: z.string().min(2, "نام کسب‌وکار الزامی است"),
  slug: z
    .string()
    .min(2, "slug حداقل ۲ کاراکتر است")
    .max(50, "slug حداکثر ۵۰ کاراکتر است")
    .regex(
      /^[a-zA-Z0-9\u0600-\u06FF]+(?:-[a-zA-Z0-9\u0600-\u06FF]+)*$/,
      "slug فقط شامل حروف فارسی یا انگلیسی، عدد و خط تیره (-) است و نباید با خط تیره شروع یا پایان یابد",
    ),
  businessType: z.string(),
  address: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export async function updateBusinessSettings(input: UpdateBusinessInput) {
  const session = await getServerSession(authOptions);
  const businessId = session?.user?.business?.id;
  const userId = session?.user?.id;

  if (!businessId || !userId) return { success: false, error: "دسترسی ندارید" };
  if (session.user.business?.businessRole !== BusinessRole.OWNER)
    return { success: false, error: "فقط مالک کسب‌وکار اجازه ویرایش دارد" };

  const parsed = updateBusinessSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.message ?? "اطلاعات نامعتبر است",
    };

  const data = parsed.data;

  try {
    const existingSlug = await prisma.business.findFirst({
      where: { slug: data.slug, NOT: { id: businessId } },
      select: { id: true },
    });
    if (existingSlug)
      return { success: false, error: "این آدرس (slug) قبلاً استفاده شده است" };

    const updatedBusiness = await prisma.$transaction(async (tx) => {
      const business = await tx.business.update({
        where: { id: businessId, ownerId: userId },
        data: {
          businessName: data.businessName,
          ownerName: data.ownerName,
          slug: data.slug,
          businessType: data.businessType as any,
          address: data.address,
          description: data.description,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "BUSINESS_UPDATED",
          entityType: "BUSINESS",
          entityId: business.id,
          businessId: business.id,
          performedBy: userId,
          actorRole: "OWNER",
          metadata: data,
        },
      });

      return business;
    });

    revalidatePath("/dashboard/business/settings");
    return { success: true, updateBusiness: updatedBusiness };
  } catch (error) {
    console.error("updateBusinessSettings error:", error);
    return { success: false, error: "خطای سرور" };
  }
}

// -----------------------------
// 2️⃣ تغییر رمز عبور مالک کسب‌وکار
// -----------------------------
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(6, "رمز عبور فعلی باید حداقل ۶ کاراکتر باشد"),
    newPassword: z
      .string()
      .min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
        "رمز عبور جدید باید شامل حداقل یک حرف، یک عدد و یک کاراکتر خاص باشد",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "رمز عبور جدید و تکرار آن یکسان نیست",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export async function changeBusinessOwnerPassword(
  input: ChangePasswordInput,
): Promise<{ success: boolean; error?: any; message?: string }> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const businessRole = session?.user?.business?.businessRole;

  if (!userId || businessRole !== BusinessRole.OWNER)
    return { success: false, error: "شما اجازه تغییر رمز عبور را ندارید" };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.message ?? "اطلاعات نامعتبر است",
    };

  const { currentPassword, newPassword } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash)
      return {
        success: false,
        error: "حساب کاربری پیدا نشد یا رمز عبور ثبت نشده است",
      };

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return { success: false, error: "رمز عبور فعلی صحیح نیست" };

    const newHashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHashedPassword },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "OWNER_PASSWORD_CHANGED",
          entityType: "BUSINESS_SETTING",
          entityId: userId,
          businessId: session.user.business?.id ?? null,
          performedBy: userId,
          actorRole: "OWNER",
          metadata: { method: "changePassword" },
        },
      });
    });

    return { success: true, message: "رمز عبور با موفقیت تغییر کرد" };
  } catch (error) {
    console.error("changeBusinessOwnerPassword error:", error);
    return { success: false, error: "خطای سرور، لطفاً دوباره تلاش کنید" };
  }
}
