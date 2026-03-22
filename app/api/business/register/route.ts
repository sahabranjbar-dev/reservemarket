import { BusinessType, NotificationType } from "@/constants/enums";
import { notificationQueue } from "@/queues/notification.queue";
import { convertToEnglishDigits, getSlug } from "@/utils/common";
import { ServerError } from "@/utils/errors";
import prisma from "@/utils/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  CUSTOMER = "CUSTOMER",
}

enum BusinessRole {
  OWNER = "OWNER",
  STAFF = "STAFF",
}
/* ==============================
   Schema
============================== */
const schema = z.object({
  ownerFullname: z.string().min(2, "نام و نام خانوادگی الزامی است"),
  phone: z.string().min(10, "شماره موبایل الزامی است"),
  businessName: z.string().min(2, "نام کسب‌وکار الزامی است"),
  address: z.string().min(2, "آدرس کسب‌وکار الزامی است"),
  businessType: z.nativeEnum(BusinessType),
  password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر"),
  username: z.string({ error: "نام کاربری الزامی است" }),
});

/* ==============================
   Helpers
============================== */
const generateUniqueSlug = async (businessName: string) => {
  const baseSlug = getSlug(businessName);

  const existingSlugs = await prisma.business.findMany({
    where: { slug: { startsWith: baseSlug } },
    select: { slug: true },
  });

  if (existingSlugs.length === 0) return baseSlug;

  const numbers = existingSlugs
    .map((b) => b.slug)
    .filter((slug) => slug !== baseSlug)
    .map((slug) => Number(slug.replace(`${baseSlug}-`, "")))
    .filter((n) => !isNaN(n));

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${baseSlug}-${next}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: true, errors: JSON.parse(parsed.error.message) },
        { status: 400 },
      );
    }

    const {
      businessName,
      ownerFullname,
      businessType,
      address,
      password,
      phone,
      username,
    } = parsed.data;

    // 1. بررسی تکراری بودن نام کاربری (identifier در جدول Business)
    const existUserName = await prisma.business.findUnique({
      where: { identifier: username },
    });

    if (existUserName) {
      return NextResponse.json(
        { success: false, message: "نام کاربری تکراری است" },
        { status: 409 },
      );
    }

    const resolvedPhone = convertToEnglishDigits(phone);
    const passwordHash = await bcrypt.hash(password, 12);
    const slug = await generateUniqueSlug(businessName);

    // 2. تراکنش برای ایجاد User, Business و BusinessMember
    const business = await prisma.$transaction(async (tx) => {
      // یافتن کاربر
      const existingUser = await tx.user.findUnique({
        where: { phone: resolvedPhone },
        select: {
          id: true,
          roles: { select: { role: true } },
          username: true, // برای چک کردن تکراری بودن یوزرنیم در جدول یوزرها
        },
      });

      let ownerId: string;

      // سناریو الف: کاربر جدید است
      if (!existingUser) {
        const newUser = await tx.user.create({
          data: {
            phone: resolvedPhone,
            fullName: ownerFullname,
            username, // ذخیره یوزرنیم
            passwordHash,
            // اضافه کردن نقش سراسری مشتری تا بتواند رزرو کند (اختیاری)
            roles: {
              create: {
                role: Role.CUSTOMER,
              },
            },
          },
        });
        ownerId = newUser.id;
      }
      // سناریو ب: کاربر قبلاً وجود دارد
      else {
        // اگر یوزرنیم وارد شده با یوزرنیم موجود فرق دارد، چک میکنیم
        if (existingUser.username && existingUser.username !== username) {
          // در اینجا سیاست امنیتی شما تعیین می‌کند.
          // اگر می‌خواهید اجازه بدهید یوزرنیم را عوض کند، اینجا آپدیت کنید.
          // فعلاً فرض می‌کنیم اگر یوزرنیم دارد، همان استفاده شود.
        } else if (!existingUser.username) {
          // اگر یوزرنیم نداشت، ست می‌کنیم
          await tx.user.update({
            where: { id: existingUser.id },
            data: { username },
          });
        }

        // اپدیت پسورد و نام (اختیاری)
        // await tx.user.update({
        //   where: { id: existingUser.id },
        //   data: {
        //     fullName: ownerFullname,
        //     passwordHash: passwordHash,
        //   },
        // });

        ownerId = existingUser.id;
      }

      // 3. ایجاد بیزنس
      const newBusiness = await tx.business.create({
        data: {
          businessName,
          slug,
          businessType,
          address,
          identifier: username,
          ownerId,
          ownerName: ownerFullname,
          isActive: false,
          registrationStatus: "PENDING",
        },
      });

      // 4. ایجاد لینک عضویت در بیزنس (BusinessMember)
      // این لینک به کاربر اجازه می‌دهد در داشبورد این بیزنس با نقش OWNER وارد شود
      await tx.businessMember.create({
        data: {
          userId: ownerId,
          businessId: newBusiness.id,
          role: BusinessRole.OWNER,
        },
      });

      return newBusiness;
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
      notifications: admins.map((item) => ({
        userId: item.id,
        title: "کسب‌وکار جدید ثبت شد",
        body: `${business.ownerName} کسب‌وکار جدید با نام ${business.businessName} را ثبت کرد`,
        sendSMS: true,
      })),
      type: NotificationType.SYSTEM,
    });

    return NextResponse.json(
      {
        success: true,
        business,
        credentials: {
          identifier: business.identifier,
        },
        message: `کسب‌وکار ${business.businessName} با موفقیت ایجاد شد و منتظر تایید مدیریت است.`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[CREATE_BUSINESS_ERROR]", error);

    // هندل کردن خطای تکراری بودن یوزرنیم در جدول User
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint") &&
      error.message.includes("User_username")
    ) {
      return NextResponse.json(
        { success: false, message: "نام کاربری انتخاب شده در سیستم وجود دارد" },
        { status: 409 },
      );
    }

    return ServerError();
  }
}
