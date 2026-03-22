"use client";
import { BaseField, CheckboxContainer, Form, TextCore } from "@/components";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface IForm {
  identifier: string;
  password: string;
}
const BusinessLoginPage = () => {
  const { push } = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: IForm) => {
    setIsLoading(true);
    const response = await signIn("password", {
      emailOrPhone: data.identifier,
      password: data.password,
      redirect: false,
    });

    if (!response?.ok) {
      toast.error("رمز عبور یا شناسه کاربری اشتباه است.");
      setIsLoading(false);
      return;
    }
    toast.success("با موفقیت وارد شدید");
    push("/auth/choose-dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* ================= LEFT COLUMN: FORM (ENHANCED) ================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24 relative z-10">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center text-slate-400 hover:text-indigo-600 transition-colors mb-8 font-medium text-sm"
          >
            <ChevronRight className="w-4 h-4 ml-1" />
            بازگشت به صفحه‌ی اصلی
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 leading-tight">
                ورود به پنل مدیریت
              </h1>
            </div>
          </div>

          <p className="text-lg text-slate-500 max-w-sm">
            برای مدیریت نوبت‌ها، پرسنل و فروش خود وارد شوید.
          </p>
        </div>

        {/* FORM */}
        <div className="w-full max-w-md">
          <Form onSubmit={onSubmit}>
            <BaseField
              name="identifier"
              component={TextCore}
              label="شناسه کاربری"
              required
              placeholder="شناسه کاربری خود را وارد کنید"
            />

            {/* Input: Password */}
            <div className="relative my-6">
              <BaseField
                name="password"
                type={showPassword ? "text" : "password"}
                component={TextCore}
                label="رمز عبور"
                required
                placeholder="رمز عبور خود را وارد کنید"
                icon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />
              <button
                type="button"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors absolute left-0 top-0"
              >
                فراموشی رمز عبور؟
              </button>
            </div>

            <BaseField
              component={CheckboxContainer}
              name="remember-me"
              text={"مرا به خاطر بسپار"}
            />

            {/* Submit Button */}
            <Button
              leftIcon={<ArrowLeft />}
              className="font-semibold w-full p-8 text-lg my-10"
              type="submit"
              loading={isLoading}
            >
              ورود به داشبورد
            </Button>
          </Form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-50 text-slate-500">یا</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-slate-600 text-sm">
              هنوز ثبت‌نام نکرده‌اید؟
              <Link
                href="/business/auth/register"
                className="font-bold text-indigo-600 hover:text-indigo-700 mr-1 transition-colors"
              >
                ثبت‌نام رایگان
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-slate-400 border-t border-slate-100 pt-6">
          تمامی حقوق برای پلتفرم رزرو مارکت محفوظ است &copy;{" "}
          {new Intl.DateTimeFormat("fa", { year: "numeric" }).format()}
        </p>
      </div>

      {/* ================= RIGHT COLUMN: VISUAL & INFO ================= */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 text-white overflow-hidden">
        {/* Background Elements bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] */}
        <div className="absolute inset-0  opacity-20"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-slate-900 via-indigo-900 to-slate-900"></div>

        {/* Decorative Blobs */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-purple-600 rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>

        {/* Content */}
        <div className="relative z-10 w-full flex flex-col justify-center px-12 lg:px-16">
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6 text-indigo-400 font-mono text-sm tracking-wider">
              <Lock className="w-4 h-4" />
              SECURE BUSINESS ACCESS
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              مدیریت یکپارچه
              <br />
              امن و حرفه‌ای
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed max-w-lg">
              با ورود امن به پنل، دفترچه کار خود را همیشه همراه داشته باشید و
              کسب‌وکارت را با داده‌های دقیق مدیریت کنید.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: <Mail />,
                title: "دریافت نوتیفیکیشن",
                desc: "آگاهی فوری از نوبت‌های جدید",
              },
              {
                icon: <Lock />,
                title: "امنیت دو مرحله‌ای",
                desc: "محافظت پیشرفته از حساب شما",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Trust Text */}
          <div className="mt-12 flex items-center gap-3 text-slate-400 text-sm">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
              <Lock className="w-4 h-4" />
            </div>
            <span>اتصال رمزنگاری شده با پروتکل TLS 1.3</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessLoginPage;
