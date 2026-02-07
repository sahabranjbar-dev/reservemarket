"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Role } from "@/constants/enums";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarMinus,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  History,
  Home,
  Image,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Package,
  Percent,
  Settings,
  Shield,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type SidebarItem = {
  title: string;
  url?: string;
  icon: LucideIcon;
  disabled?: boolean;
  children?: SidebarItem[];
};

type UserRoleType = "admin" | "business" | "staff" | "customer";

// --- 1. Business Owner (مدیر کسب‌وکار) ---
const businessSideBarItems: SidebarItem[] = [
  { title: "داشبورد مدیریتی", url: "/", icon: LayoutDashboard },

  {
    title: "نوبت‌دهی و تقویم",
    icon: Calendar,
    children: [
      { title: "لیست رزروها", url: "/bookings/list", icon: ClipboardList },
      { title: "تقویم رزروها", url: "/bookings/calendar", icon: Calendar },
    ],
  },
  {
    title: "مدیریت مشتریان",
    icon: Users,
    children: [{ title: "لیست مشتریان", url: "/customers", icon: Users }],
  },
  {
    title: "منابع و خدمات",
    icon: Package,
    children: [
      {
        title: "خدمات",
        url: "/resources/services",
        icon: ListChecks,
      },
      { title: "پرسنل", url: "/resources/staff", icon: UserRound },
      { title: "شیفت‌ها", url: "/resources/shifts", icon: CalendarClock },
      { title: "استثنائات", url: "/resources/exceptions", icon: CalendarMinus },
      {
        title: "درخواست‌های تغییر",
        url: "/resources/change-requests",
        icon: CalendarMinus,
      },
    ],
  },
];

const customerSideBarItems: SidebarItem[] = [
  {
    title: "داشبورد من",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "نوبت‌دهی و خدمات",
    icon: Calendar,
    children: [
      { title: "نوبت‌های فعال", url: "/bookings/active", icon: CalendarCheck },
      { title: "تاریخچه نوبت‌ها", url: "/bookings/history", icon: History },
    ],
  },
  {
    title: "پشتیبانی و تیکت",
    url: "/support",
    icon: LifeBuoy,
  },
];

// --- 3. Staff (پرسنل) ---
const staffSideBarItems: SidebarItem[] = [
  { title: "داشبورد", url: "/", icon: Home },
  { title: "تقویم کاری", url: "/schedule", icon: Calendar },
  { title: "نوبت‌ها", url: "/bookings", icon: CalendarCheck },
  {
    title: "خدمات",
    icon: ListChecks,
    url: "/services",
  },
];

// --- 4. Admin (مدیر سیستم) ---
const adminSideBarItems: SidebarItem[] = [
  // داشبورد اصلی ادمین
  { title: "داشبورد مدیریت", url: "/", icon: LayoutDashboard },

  // مدیریت کاربران
  {
    title: "مدیریت کاربران",
    icon: Users,
    children: [
      { title: "همه کاربران", url: "/users/all", icon: Users },
      // { title: "مدیران سیستم", url: "/users/admins", icon: Shield },
    ],
  },

  // مدیریت کسب‌وکارها
  {
    title: "مدیریت کسب‌وکارها",
    icon: Globe,
    children: [{ title: "لیست کسب‌وکارها", url: "/businesses", icon: Globe }],
  },

  {
    title: "مدیریت نوبت‌ها",
    icon: Globe,
    children: [
      { title: "لیست نوبت‌ها", url: "/bookings", icon: ClipboardList },
    ],
  },

  // مالی و کمیسیون‌ها
  // {
  //   title: "مالی و کمیسیون",
  //   icon: Banknote,
  //   children: [
  //     {
  //       title: "تراکنش‌های سیستم",
  //       url: "/finance/transactions",
  //       icon: CreditCard,
  //     },
  //   ],
  // },

  // مدیریت محتوا
  // {
  //   title: "مدیریت محتوا",
  //   icon: FileText,
  //   children: [
  //     { title: "بنرها و اسلایدرها", url: "/content/banners", icon: Image },
  //     { title: "وبلاگ و اخبار", url: "/content/blog", icon: FileText },
  //   ],
  // },

  // پشتیبانی و تیکت‌ها

  {
    title: "پشتیبانی و پیام‌ها",
    icon: HelpCircle,
    children: [
      { title: "تیکت‌های پشتیبانی", url: "/support-tickets", icon: HelpCircle },
      {
        title: "پیام‌های تماس با ما",
        url: "/contact-messages",
        icon: FileText,
      },
    ],
  },

  // تنظیمات سیستمی
];

function getUserRole(session: any): UserRoleType {
  if (session?.user?.roles?.includes(Role.SUPER_ADMIN)) {
    return "admin";
  }
  if (session?.user?.business?.businessRole === "OWNER") {
    return "business";
  }
  if (session?.user?.business?.businessRole === "STAFF") {
    return "staff";
  }
  return "customer";
}

export function useSidebarConfig() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return useMemo(() => {
    if (status === "loading") {
      return { items: [], role: "customer" as UserRoleType };
    }

    const role = getUserRole(session);

    let items: SidebarItem[] = [];
    switch (role) {
      case "admin":
        if (!pathname.includes(role)) {
          items = customerSideBarItems;
          break;
        }
        items = adminSideBarItems;
        break;
      case "business":
        if (!pathname.includes(role)) {
          items = customerSideBarItems;
          break;
        }

        items = businessSideBarItems;
        break;
      case "staff":
        if (!pathname.includes(role)) {
          items = customerSideBarItems;
          break;
        }
        items = staffSideBarItems;
        break;
      default:
        items = customerSideBarItems;
        break;
    }

    return { items, role };
  }, [pathname, session, status]);
}

interface SidebarItemProps {
  item: SidebarItem;
  pathname: string;
  role: UserRoleType;
}

function SidebarItemComponent({ item, pathname, role }: SidebarItemProps) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const basePath = `/dashboard/${pathname.split("/")[2]}`;

  // Helper to check URL activity
  const isUrlActive = (url: string) => {
    if (url === "/") return pathname === basePath;
    return pathname.startsWith(`${basePath}${url}`);
  };

  // Determine if the parent item is active
  const isParentActive = useMemo(() => {
    if (hasChildren) {
      return item.children!.some(
        (child) => child.url && isUrlActive(child.url),
      );
    }
    return !!item.url && isUrlActive(item.url);
  }, [item, pathname, role, basePath, hasChildren, isUrlActive]);

  // Collapsible state
  const defaultOpen = hasChildren && isParentActive;
  const [open, setOpen] = useState<boolean>(() => defaultOpen);

  // Render Parent with Children
  if (hasChildren) {
    return (
      <SidebarMenuItem>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title} isActive={isParentActive}>
              <Icon />
              <div className="flex flex-1 justify-between items-center">
                <span className="truncate">{item.title}</span>
                <ChevronRight
                  className={cn(
                    "ml-2 h-4 w-4 transition-transform duration-200 ltr:rotate-0 rtl:-rotate-180",
                    open && "ltr:rotate-90 rtl:rotate-90",
                  )}
                />
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children!.map((sub) => {
                const subUrl = sub.url;
                const isSubActive = subUrl ? isUrlActive(subUrl) : false;
                const SubIcon = sub.icon;

                return (
                  <SidebarMenuSubItem key={`${item.title}-${sub.title}`}>
                    <SidebarMenuSubButton asChild isActive={isSubActive}>
                      <Link
                        href={`${basePath}${subUrl}`}
                        className="flex justify-start items-center gap-2"
                      >
                        {SubIcon && <SubIcon className="h-4 w-4" />}
                        <span>{sub.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    );
  }

  // Render Simple Item
  const itemUrl = `${basePath}${item.url}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={item.title}
        isActive={isParentActive}
        disabled={item.disabled}
        className={cn(item.disabled && "opacity-50 pointer-events-none")}
      >
        <Link href={itemUrl} className="flex items-center gap-2">
          {Icon && <Icon />}
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ==========================================
// Main Sidebar Component
// ==========================================

export default function AppSidebar() {
  const pathname = usePathname();
  const { items, role } = useSidebarConfig();

  if (!items.length) return null;

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarItemComponent
          key={item.title}
          item={item}
          pathname={pathname}
          role={role}
        />
      ))}
    </SidebarMenu>
  );
}
