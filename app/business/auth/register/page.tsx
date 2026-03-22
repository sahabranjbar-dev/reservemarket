import { Building, Calendar, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import RegisterStepForm from "./_components/RegisterStepForm";

const BusinessRegisterPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
        {/* ================= LEFT: FORM SECTION ================= */}
        <div className="w-full lg:w-3/5 xl:w-1/2 h-full overflow-y-auto bg-white relative z-20 flex flex-col p-12">
          {/* Header */}
          <div className="px-6 lg:px-12 pb-6 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <Building className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">
                رزرو مارکت بیزنس
              </span>
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              بازگشت به سایت
            </Link>
          </div>

          {/* Main Content */}
          <RegisterStepForm />

          <div className="text-center">
            <p className="text-slate-600 text-sm">
              ثبت‌نام کرده‌اید؟ وارد شوید.
            </p>
            <Link
              href="/business/auth/login"
              className="font-bold text-indigo-600 hover:text-indigo-700 mr-1 transition-colors"
            >
              ورود به حساب
            </Link>
          </div>
        </div>

        {/* ================= RIGHT: MARKETING / INFO ================= */}
        <div className="hidden lg:flex lg:w-2/5 xl:w-1/2 relative bg-slate-900 text-white overflow-hidden p-6">
          {/* Background Decor */}
          <div className="absolute inset-0 bg-linear-to-br from-indigo-900 to-slate-900 opacity-90"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-x-1/2 translate-y-1/2"></div>

          <div className="relative z-10 h-full flex flex-col justify-center px-12 lg:px-16">
            <div className="mb-12">
              <span className="text-indigo-400 font-bold tracking-widest uppercase text-sm mb-4 block">
                Business Manager
              </span>
              <h2 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
                مدیریت هوشمند
                <br />
                پیشرفت کسب‌وکار
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed max-w-lg">
                به هزاران صاحب کسب‌وکار بپیوندید که با رزرو مارکت، زمان خود را
                بهتر مدیریت می‌کنند و درآمد خود را افزایش می‌دهند.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-4 mb-12">
              {[
                {
                  icon: <Calendar className="w-5 h-5" />,
                  title: "مدیریت تقویم هوشمند",
                  desc: "جلوگیری از تداخل نوبت‌ها و مدیریت راحت زمان‌بندی‌ها.",
                },
                {
                  icon: <TrendingUp className="w-5 h-5" />,
                  title: "گزارش‌گیری مالی",
                  desc: "مشاهده دقیق درآمد و کمیسیون‌ها در داشبورد اختصاصی.",
                },
                {
                  icon: <ShieldCheck className="w-5 h-5" />,
                  title: "ضمانت بازگشت وجه",
                  desc: "پرداخت امن و تضمین شده برای شما و مشتریان.",
                },
              ].map((item) => (
                <div
                  key={item?.title}
                  className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <div className="flex -space-x-3 space-x-reverse">
                <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-900"></div>
                <div className="w-10 h-10 rounded-full bg-slate-600 border-2 border-slate-900"></div>
                <div className="w-10 h-10 rounded-full bg-indigo-500 border-2 border-slate-900 flex items-center justify-center text-xs font-bold">
                  +5k
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                به جمع حرفه‌ای‌ها بپیوندید
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessRegisterPage;
