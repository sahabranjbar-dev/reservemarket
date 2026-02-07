export enum BusinessType {
  SALON = "SALON",
  GYM = "GYM",
  CLINIC = "CLINIC",
  BEAUTY = "BEAUTY",
  EDUCATION = "EDUCATION",
  SPORTS = "SPORTS",
  CAFE = "CAFE",
  RESTAURANT = "RESTAURANT",
  LAW = "LAW",
  DENTAL = "DENTAL",
  VETERINARY = "VETERINARY",
  CONSULTING = "CONSULTING",
  OTHER = "OTHER",
}

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  CUSTOMER = "CUSTOMER",
}

export enum BusinessRole {
  OWNER = "OWNER",
  STAFF = "STAFF",
}

export enum BookingStatus {
  PENDING = "PENDING", // در انتظار تائید

  CONFIRMED = "CONFIRMED", //تایید شد، خدمت اجرا می‌شود

  REJECTED = "REJECTED", //مدیر تایید نکرد

  CANCELED = "CANCELED", //لغو شد

  COMPLETED = "COMPLETED", // انجام شد

  NO_SHOW_CUSTOMER = "NO_SHOW_CUSTOMER", // مشتری نیامد

  NO_SHOW_STAFF = "NO_SHOW_STAFF", // کارمند نیامد
}

export enum BusinessRegistrationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ExceptionType {
  ONE_DAY_CHANGE = "ONE_DAY_CHANGE",
  MULTI_DAYS_CHANGE = "MULTI_DAYS_CHANGE",
  RANGE_DAYS_CHANGE = "RANGE_DAYS_CHANGE",

  ONE_DAY_CLOSE = "ONE_DAY_CLOSE",
  MULTI_DAYS_CLOSE = "MULTI_DAYS_CLOSE",
  RANGE_DAYS_CLOSE = "RANGE_DAYS_CLOSE",
}

export enum NotificationType {
  SYSTEM = "SYSTEM",
  BOOKING = "BOOKING",
  MESSAGE = "MESSAGE",
  SERVICE_CHANGE = "SERVICE_CHANGE",
}
