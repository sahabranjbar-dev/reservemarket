"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Activity, useState, useTransition } from "react";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import BusinessCard from "./BusinessCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getBusinessTypeOptions } from "../_meta/utils";

// تایپ دیتا
type Business = {
  id: string;
  slug: string;
  businessName: string;
  businessType: string;
  description: string | null;
  address: string | null;
  banner: string | null;
  logo: string | null;
};

interface Meta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ClientBusinessListProps {
  initialBusinesses: Business[];
  initialMeta: Meta;
  currentParams: {
    category: string;
    query: string;
  };
}

const ClientBusinessList = ({
  initialBusinesses,
  initialMeta,
  currentParams,
}: ClientBusinessListProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // برای نمایش لودینگ کوچک در هنگام پیجینیشن (UX بهتر)
  const [isPending, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(currentParams.query);

  const businessTypes = getBusinessTypeOptions();

  // تابعی برای ایجاد URL جدید با پارامترهای فیلتر شده
  const updateUrl = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // همیشه صفحه را به ۱ ریست کن اگر فیلترها تغییر کردند (اختیاری، اما تجربه کاربری بهتری است)
    if (newParams.category && newParams.category !== currentParams.category) {
      params.delete("page");
    }
    if (
      newParams.query !== undefined &&
      newParams.query !== currentParams.query
    ) {
      params.delete("page");
    }

    const url = `${pathname}?${params.toString()}`;
    router.push(url);
  };

  // هندل کردن سرچ (فقط با زدن اینتر اعمال می‌شود تا برای هر کاراکتر ریکوئست نزند)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      updateUrl({ query: searchInput });
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* ==========================================
          بخش سرچ و فیلتر
      ========================================== */}
      <div className="space-y-6">
        <div className="text-center md:text-right">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            مراکز خدمات و رزرو
          </h1>
          <p className="text-slate-500">
            بهترین گزینه‌ها را انتخاب و رزرو کنید
          </p>
        </div>

        {/* سرچ */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative max-w-2xl mx-auto md:mx-0"
        >
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="جستجوی نام کسب‌وکار، آدرس یا خدمات..."
            className="w-full py-4 pl-14 pr-12 text-slate-900 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          <Activity mode={searchInput.length ? "visible" : "hidden"}>
            <span
              className="absolute left-24 top-1/2 -translate-y-1/2 cursor-pointer"
              onClick={() => {
                setSearchInput("");
                startTransition(() => {
                  updateUrl({ query: null });
                });
              }}
            >
              <X className="text-red-400" />
            </span>
          </Activity>
          <button
            type="submit"
            className="absolute inset-y-0 left-2 my-2 px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            جستجو
          </button>
        </form>

        {/* دسته‌بندی‌ها */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          <div className="flex gap-3 min-w-max justify-start md:justify-center">
            {/* دکمه همه */}
            <button
              onClick={() =>
                startTransition(() => updateUrl({ category: "all" }))
              }
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl border-2 transition-all font-bold text-sm whitespace-nowrap",
                currentParams.category === "all"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200"
                  : "bg-white text-slate-600 border-transparent hover:border-slate-200 hover:bg-slate-50",
              )}
            >
              همه
            </button>

            {/* دکمه‌های دسته‌بندی */}
            {businessTypes.map((type) => {
              const Icon = type.icon;
              const isActive = type.id === currentParams.category;
              return (
                <button
                  key={type.id}
                  onClick={() =>
                    startTransition(() => updateUrl({ category: type.id }))
                  }
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl border-2 transition-all font-medium text-sm whitespace-nowrap",
                    isActive
                      ? "bg-white text-indigo-600 border-indigo-600 shadow-md"
                      : "bg-white text-slate-500 border-transparent hover:border-slate-200 hover:text-slate-700",
                  )}
                >
                  {Icon && <Icon className="w-5 h-5" />}
                  <span>{type.titleFa}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==========================================
          لیست و وضعیت لودینگ
      ========================================== */}
      {isPending && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {initialBusinesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-100">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">موردی یافت نشد</h3>
          <p className="text-slate-500">لطفاً فیلترهای جستجو را تغییر دهید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialBusinesses.map((business: any) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}

      {/* ==========================================
          پیجینیشن
      ========================================== */}
      {initialMeta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-8">
          {/* قبلی */}
          <Button
            variant="outline"
            size="icon"
            disabled={!initialMeta.hasPrev || isPending}
            onClick={() => {
              const newPage = String(initialMeta.currentPage - 1);
              startTransition(() => updateUrl({ page: newPage }));
            }}
            className="rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          {/* شماره صفحات */}
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(initialMeta.totalPages, 5) }).map(
              (_, i) => {
                // لاجیک ساده برای نمایش فقط ۵ صفحه اطراف صفحه فعلی
                let pageNum = 1;
                if (initialMeta.currentPage <= 3) pageNum = i + 1;
                else if (initialMeta.currentPage >= initialMeta.totalPages - 2)
                  pageNum = initialMeta.totalPages - 4 + i;
                else pageNum = initialMeta.currentPage - 2 + i;

                if (pageNum < 1 || pageNum > initialMeta.totalPages)
                  return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      startTransition(() =>
                        updateUrl({ page: String(pageNum) }),
                      );
                    }}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                      initialMeta.currentPage === pageNum
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                    )}
                  >
                    {pageNum}
                  </button>
                );
              },
            )}
          </div>

          {/* بعدی */}
          <Button
            variant="outline"
            size="icon"
            disabled={!initialMeta.hasNext || isPending}
            onClick={() => {
              const newPage = String(initialMeta.currentPage + 1);
              startTransition(() => updateUrl({ page: newPage }));
            }}
            className="rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ClientBusinessList;
