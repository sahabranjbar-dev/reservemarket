import { ROLE_LABELS_EN, ROLE_LABELS_FA } from "@/constants/common";
import { UserRole } from "@/types/common";
import * as zod from "zod";

type RoleSummary = {
  roles: UserRole[];
  count: number;
  labelsFa: string[];
  labelsEn: string[];
};

// نقشه‌ی تبدیل ارقام فارسی و عربی به انگلیسی
const FARSI_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// تبدیل‌کننده‌ی واحد
export const convertToEnglishDigits = (input: string): string => {
  return input.replace(/[۰-۹٠-٩]/g, (char) => {
    const fIndex = FARSI_DIGITS.indexOf(char);
    if (fIndex !== -1) return String(fIndex);

    const aIndex = ARABIC_DIGITS.indexOf(char);
    if (aIndex !== -1) return String(aIndex);

    return char;
  });
};

const FARSI_DIGITS_ARRAY = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const convertToFarsiDigits = (input: string): string => {
  return input.replace(/\d/g, (digit) => {
    return FARSI_DIGITS_ARRAY[Number(digit)];
  });
};

// اسکیما با خوانایی بهتر
export const mobileValidation = () =>
  zod.object({
    phone: zod
      .string()
      .min(1, { error: "شماره موبایل الزامی است." })
      .max(11, { error: "شماره موبایل باید دقیقاً ۱۱ رقم باشد." })
      .length(11, { error: "شماره موبایل باید دقیقاً ۱۱ رقم باشد." })
      .trim()
      .transform(convertToEnglishDigits)
      .pipe(
        zod
          .string()
          .regex(/^09\d{9}$/, { error: "شماره موبایل باید با ۰۹ شروع شود." }),
      ),
  });

export function formatPrice(value: string) {
  if (!value) return "";
  const number = Number(value.replace(/,/g, ""));
  if (Number.isNaN(number)) return "";
  return number.toLocaleString("fa-IR");
}

export function unFormatPrice(value: string) {
  if (!value) return "";
  return value.replace(/,/g, "");
}

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFilePreview = (file?: File | Blob | { publicUrl?: string }) => {
  if (!file) return null;

  // اگر از بک‌اند اومده
  if ("publicUrl" in file && file.publicUrl) {
    return file.publicUrl;
  }

  // اگر واقعاً File یا Blob است
  if (file instanceof File || file instanceof Blob) {
    return URL.createObjectURL(file);
  }

  return null;
};

export const mustBetween = (
  min: number,
  max: number,
  fieldName = "این مقدار",
) => {
  return (value: number) => {
    if (value < min || value > max) {
      return `${fieldName} باید بین ${Number(min).toLocaleString(
        "fa",
      )} و ${Number(max).toLocaleString("fa")} باشد.`;
    }
    return true;
  };
};

export function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "لحظاتی پیش";
  if (hours < 24) return `${hours} ساعت پیش`;

  const days = Math.floor(hours / 24);
  return `${days} روز پیش`;
}

export function getUserRolesSummary(
  userRoles: UserRole | UserRole[],
): RoleSummary {
  const rolesArray = Array.isArray(userRoles) ? userRoles : [userRoles];

  const uniqueRoles = Array.from(new Set(rolesArray)) as UserRole[];

  const labelsFa = uniqueRoles.map((r) => ROLE_LABELS_FA[r]).filter(Boolean);

  const labelsEn = uniqueRoles.map((r) => ROLE_LABELS_EN[r]).filter(Boolean);

  return {
    roles: uniqueRoles,
    count: uniqueRoles.length,
    labelsFa,
    labelsEn,
  };
}

export function combineDateAndTime(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export const getSlug = (slug: string) => {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const getRole = (roles?: string[]) => {
  let url = "";
  switch (true) {
    case roles?.includes("SUPER_ADMIN"):
      url = "admin";
      break;
    case roles?.includes("BUSINESS_OWNER"):
      url = "business";
      break;
    case roles?.includes("STAFF"):
      url = "staff";
      break;
    case roles?.includes("CUSTOMER"):
      url = "customer";
      break;

    default:
      url = "customer";

      break;
  }

  return url;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fa-IR").format(amount);
};

export const copyTextToClipboard = (text: string): Promise<unknown> => {
  return navigator.clipboard.writeText(text);
};

export const getFullDateTime = (date?: Date) => {
  return date
    ? new Intl.DateTimeFormat("fa-IR", {}).format(date) +
        " " +
        new Intl.DateTimeFormat("fa-IR", {
          weekday: "long",
        }).format(date) +
        " " +
        getHour(date)
    : "---";
};

export const getFullDate = (date?: Date) => {
  return date
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(date) +
        "  |  " +
        new Intl.DateTimeFormat("fa-IR").format(date)
    : "---";
};

export function validateEmail(
  email?: string,
  isRequired = true,
): {
  valid: boolean;
  message: string;
} {
  if (!email && isRequired) {
    return { valid: false, message: "ایمیل الزامی است" };
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (email && !regex.test(email)) {
    return { valid: false, message: "فرمت ایمیل صحیح نیست" };
  }

  return { valid: true, message: "فرمت ایمیل درست می‌باشد" };
}

export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDay()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export const getHour = (date: Date) => {
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return `${hour}:${minute}`;
};
