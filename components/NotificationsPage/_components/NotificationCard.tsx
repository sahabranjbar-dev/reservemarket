import { useSidebarConfig } from "@/app/dashboard/_components/SideBarItem";
import { Button } from "@/components/ui/button";
import { Eye, Trash2 } from "lucide-react";
import Link from "next/link";

interface NotificationCardProps {
  title: string;
  desc: string;
  time: string;
  read: boolean;
  icon?: any;
  color: string;
  id: string;
}

const NotificationCard = ({
  title,
  desc,
  time,
  read,
  icon: Icon,
  color,
  id,
}: NotificationCardProps) => {
  const { role } = useSidebarConfig();

  return (
    <div
      className={`
        relative group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200
        ${read ? "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm" : "bg-indigo-50/40 border-indigo-100 shadow-sm hover:shadow-md"}
      `}
    >
      {/* Unread Indicator Line */}
      {!read && (
        <div className="absolute right-0 top-4 bottom-4 w-1 bg-indigo-500 rounded-l-full" />
      )}

      {/* Icon */}
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon size={20} className="text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex justify-between items-start mb-1">
          <h4
            className={`text-sm font-semibold truncate ${read ? "text-slate-700" : "text-slate-900"}`}
          >
            {title}
          </h4>
          <span className="text-xs text-slate-400 whitespace-nowrap me-2">
            {time}
          </span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-2">
          {desc}
        </p>

        {/* Action Buttons (Visible on Hover) */}
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/${role}/notifications/${id}`}>
            <Button
              rightIcon={<Eye />}
              variant="link"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              مشاهده جزئیات
            </Button>
          </Link>
          <span className="text-slate-300">•</span>
        </div>
      </div>
    </div>
  );
};

export default NotificationCard;
