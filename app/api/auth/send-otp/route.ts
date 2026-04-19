import { createLog } from "@/log/log.service";
import { convertToEnglishDigits, mobileValidation } from "@/utils/common";
import { ServerError } from "@/utils/errors";
import prisma from "@/utils/prisma";
import { sendSMS } from "@/utils/sms";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const RESEND_DELAY = 60 * 1000; // 60 ثانیه
const EXPIRE_TIME = 2 * 60 * 1000; // 2 دقیقه

async function cleanupExpiredOtps() {
  await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

function generateOtp(): string {
  return randomInt(100_000, 999_999).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. استانداردسازی و اعتبارسنجی شماره تلفن
    if (!body.phone) {
      await createLog({
        level: "WARN",
        message: "شماره تلفن ارسال نشده است",
        context: { body },
      });
      return NextResponse.json(
        { error: "شماره تلفن وارد نشده است." },
        { status: 400 },
      );
    }

    const validation = mobileValidation().safeParse(body);
    if (!validation.success) {
      await createLog({
        level: "WARN",
        message: "اعتبارسنجی شماره تلفن ناموفق بود",
        context: { body, errors: validation.error.format() },
      });
      return NextResponse.json(
        { error: validation.error?.message || "اطلاعات نامعتبر است." },
        { status: 400 },
      );
    }

    const phone = validation.data.phone;
    const resolvedPhone = convertToEnglishDigits(phone);

    // 2. بررسی Rate Limiting
    const lastOtp = await prisma.otpCode.findUnique({
      where: { phone: resolvedPhone },
    });
    if (lastOtp) {
      const timeSinceLast = new Date().getTime() - lastOtp.createdAt.getTime();
      if (timeSinceLast < RESEND_DELAY) {
        const remainingSeconds = Math.ceil(
          (RESEND_DELAY - timeSinceLast) / 1000,
        );
        await createLog({
          level: "INFO",
          message: "کاربر سعی در دریافت OTP قبل از پایان زمان انتظار داشت",
          context: { phone, remainingSeconds },
        });
        return NextResponse.json(
          {
            error: `لطفاً ${remainingSeconds} ثانیه برای دریافت مجدد کد صبر کنید.`,
          },
          { status: 429 },
        );
      }
    }

    // 3. پاک‌سازی کدهای منقضی شده
    await cleanupExpiredOtps();

    // 4. تولید و هش کردن کد
    const code = generateOtp();
    const hashedCode = await bcrypt.hash(code, 10);
    const expirationDate = new Date(Date.now() + EXPIRE_TIME);

    // 5. ذخیره یا به‌روزرسانی کد
    await prisma.otpCode.upsert({
      where: { phone: resolvedPhone },
      update: {
        expiresAt: expirationDate,
        codeHash: hashedCode,
        createdAt: new Date(),
      },
      create: {
        phone: resolvedPhone,
        codeHash: hashedCode,
        expiresAt: expirationDate,
        createdAt: new Date(),
      },
    });

    const templateId = process.env.SMS_OTP_TEMPLATE_ID!;

    // 6. ارسال پیامک
    const smsSent = await sendSMS(phone, templateId, [
      { name: "CODE", value: code },
    ]);
    if (!smsSent) {
      await createLog({
        level: "ERROR",
        message: "ارسال پیامک OTP با خطا مواجه شد",
        context: { phone, code },
      });
      return NextResponse.json(
        { error: "ارسال پیامک با خطا مواجه شد." },
        { status: 500 },
      );
    }

    console.log(code, "code");

    await createLog({
      level: "INFO",
      message: "OTP با موفقیت ایجاد شد",
      context: { phone, code, expiresAt: expirationDate },
    });

    return NextResponse.json({
      success: true,
      message: "کد تایید با موفقیت ارسال شد",
      mobile: phone,
    });
  } catch (error) {
    await createLog({
      level: "ERROR",
      message: "POST /otp Exception",
      context: { error: (error as any).message || error },
    });
    console.error("POST /otp Exception:", error);
    return ServerError();
  }
}
