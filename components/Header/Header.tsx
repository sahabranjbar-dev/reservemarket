"use client";

import clsx from "clsx";
import {
  BookOpenCheck,
  Building2,
  HomeIcon,
  LayoutDashboard,
  MessageCircleMore,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderMenu from "../HeaderMenu/HeaderMenu";
import LoginButton from "../LoginButton/LoginButton";

const hiddenRoutes = [
  "/auth",
  "/dashboard",
  "/business/auth/register",
  "/business/auth/login",
];

const menuItems = [
  { title: "خانه", href: "/", icon: <HomeIcon size={18} /> },
  {
    title: "داشبورد",
    href: "/auth/choose-dashboard",
    icon: <LayoutDashboard size={18} />,
    target: "_blank",
  },
  { title: "درباره ما", href: "/about-us", icon: <BookOpenCheck size={18} /> },
  {
    title: "تماس با ما",
    href: "/contact-us",
    icon: <MessageCircleMore size={18} />,
  },
  { title: "رزرو نوبت", href: "/business", icon: <Building2 size={18} /> },
];

const Header = () => {
  const pathname = usePathname();

  if (hiddenRoutes.some((r) => pathname.startsWith(r))) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-xl supports-backdrop-filter:bg-white/60">
      <nav className="container mx-auto px-4 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo Section */}
          <Link
            href="/"
            className="group flex items-center gap-3 transition-opacity active:opacity-80"
          >
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200 transition-transform duration-300 group-hover:scale-105">
              <Image
                src={"/images/logo.png"}
                alt="logo"
                fill
                className="object-cover p-1.5"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-slate-800 tracking-tight">
                رزرو مارکت
              </span>
              <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">
                سامانه رزرو آنلاین
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-1.5">
              {menuItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      target={item.target}
                      className={clsx(
                        "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <span
                        className={clsx("transition-colors", {
                          "text-indigo-600": isActive,
                          "text-slate-400 group-hover:text-slate-600":
                            !isActive,
                        })}
                      >
                        {item.icon}
                      </span>
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Desktop Auth Button */}
            <div className="hidden md:block">
              <LoginButton />
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors">
                <HeaderMenu />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
