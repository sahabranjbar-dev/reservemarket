"use server";

import { authOptions } from "@/utils/authOptions";
import { convertToEnglishDigits, validateEmail } from "@/utils/common";
import prisma from "@/utils/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// -----------------------------
// 1️⃣ اعتبارسنجی کد OTP
// -----------------------------
export async function otCodeValidate({
  code,
  phone,
}: {
  phone: string;
  code: string;
}) {
  try {
    const session = await getServerSession(authOptions);

    const resolvedPhone = convertToEnglishDigits(phone);
    const resolvedCode = convertToEnglishDigits(code);

    const otp = await prisma.otpCode.findUnique({
      where: { phone: resolvedPhone },
    });

    if (!otp || otp.expiresAt < new Date())
      return { success: false, message: "کد منقضی شده است" };

    const isValid = await bcrypt.compare(resolvedCode, otp.codeHash);
    if (!isValid) return { success: false, message: "کد اشتباه است" };

    await prisma.otpCode.delete({ where: { phone: resolvedPhone } });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: "OTP_VERIFIED",
        entityType: "USER",
        entityId: otp.phone ?? null,
        businessId: null,
        performedBy: session?.user.id,
        actorRole: "CUSTOMER",
        metadata: { phone: resolvedPhone },
      },
    });

    return { success: true, message: "کد تایید شد", phone: resolvedPhone };
  } catch (error) {
    console.error("otCodeValidate error:", error);
    return { success: false, message: "خطای سرور" };
  }
}

// -----------------------------
// 2️⃣ ویرایش پروفایل مشتری
// -----------------------------
interface IData {
  phone: string;
  email?: string | null;
  username?: string | null;
  fullName?: string | null;
}

const updateSchema = z.object({
  phone: z
    .string()
    .min(1, { error: "شماره موبایل الزامی است." })
    .max(11, { error: "شماره موبایل باید دقیقاً ۱۱ رقم باشد." })
    .length(11, { error: "شماره موبایل باید دقیقاً ۱۱ رقم باشد." })
    .trim()
    .transform(convertToEnglishDigits)
    .pipe(
      z
        .string()
        .regex(/^09\d{9}$/, { error: "شماره موبایل باید با ۰۹ شروع شود." }),
    ),
  fullName: z.string().nullable().optional(),
  email: z
    .string()
    .nullable()
    .optional()
    .refine((email) => email === null || validateEmail(email, false).valid, {
      message: "فرمت ایمیل صحیح نیست",
    }),
  username: z.string().nullable().optional(),
});

export async function updateCustomerProfile(data: IData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const userId = session.user.id;
    const parsed = updateSchema.safeParse(data);
    if (!parsed.success)
      return { success: false, message: parsed.error.message };

    const { phone, email, fullName, username } = parsed.data;

    // بررسی تکراری بودن نام کاربری
    if (username) {
      const isExistUserName = await prisma.user.findFirst({
        where: { username, id: { not: userId } },
      });
      if (isExistUserName)
        return { success: false, message: "نام کاربری تکراری است" };
    }

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (username !== undefined) updateData.username = username;
    if (fullName !== undefined) updateData.fullName = fullName;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: "CUSTOMER_PROFILE_UPDATED",
          entityType: "USER",
          entityId: userId,
          businessId: null,
          performedBy: userId,
          actorRole: "CUSTOMER",
          metadata: updateData,
        },
      });

      return user;
    });

    revalidatePath("/dashboard/customer/settings");

    return {
      success: true,
      message: "اطلاعات پروفایل با موفقیت ویرایش شد",
      updatedUser,
    };
  } catch (error) {
    console.error("updateCustomerProfile error:", error);
    return { success: false, message: "خطای سرور" };
  }
}
