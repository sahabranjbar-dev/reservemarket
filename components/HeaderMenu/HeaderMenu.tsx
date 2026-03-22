"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import LoginButton from "../LoginButton/LoginButton";

const menuItems = [
  { title: "خانه", href: "/" },
  { title: "داشبورد", href: "/dashboard" },
  { title: "درباره ما", href: "/about-us" },
  { title: "تماس با ما", href: "/contact-us" },
  { title: "رزرو نوبت", href: "/business" },
];

const HeaderMenu = () => {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  return (
    <Drawer direction="right" open={drawerOpen} onOpenChange={setDrawerOpen}>
      {/* دکمه باز کردن منو */}
      <DrawerTrigger asChild>
        <Button variant="outline">
          <Menu />
        </Button>
      </DrawerTrigger>

      <DrawerContent className="w-72 p-4">
        {/* هدر منو */}
        <DrawerHeader className="relative border-b pb-2">
          <DrawerTitle className="text-lg font-bold">رزرو مارکت</DrawerTitle>
          <DrawerDescription className="text-sm text-neutral-500">
            رزرو آنلاین نوبت
          </DrawerDescription>
        </DrawerHeader>

        {/* لینک‌ها */}
        <nav className="mt-6">
          <ul className="flex flex-col gap-4">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-2 px-3 rounded hover:bg-neutral-100 transition-colors"
                  onClick={() => {
                    setDrawerOpen(false);
                  }}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* دکمه‌ها در فوتر */}
        <div className="mt-auto pb-8 pt-4 border-t flex flex-col gap-4">
          <LoginButton className="border p-2 rounded-lg" />

          <DrawerClose asChild>
            <Button variant="outline" className="w-full ">
              بستن منو
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default HeaderMenu;
