"use client";

import { CustomTable, ListHeader, StatusBadge } from "@/components";
import PaginationWrapper from "@/components/Pagination/Pagination";
import { Badge } from "@/components/ui/badge";
import ListContainer from "@/container/ListContainer/ListContainer";
import ListDataProvider from "@/container/ListDataProvider/ListDataProvider";
import { ITableColumns } from "@/types/Table";
import { getFullDateTime, getHour } from "@/utils/common";
import { Calendar, Clock, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BookingListMoreButton from "./BookingListMoreButton";
import BusinessBookingsFilters from "./BusinessBookingsFilters";

interface Props {
  data: {
    page: number;
    pageSize: number;
    resultList: any[];
    totalItems: number;
    totalPages: number;
  };
}

const BusinessBookingsTable = ({ data }: Props) => {
  const { replace } = useRouter();

  const searchParams = useSearchParams();

  const onPageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);

    params.delete("page");

    params.append("page", String(page));

    replace(`/dashboard/business/bookings/list?${params}`);
  };

  const columns: ITableColumns[] = [
    {
      field: "rowNumber",
      title: "ردیف",
    },
    {
      title: "نام",
      field: "customer",
      render: (customer) => {
        return (
          <div key={customer?.id}>
            <span>{customer.fullName ?? "---"}</span>
          </div>
        );
      },
    },
    {
      title: "تلفن تماس",
      field: "customer",
      render: (customer) => {
        return (
          <div key={customer?.id}>
            <Link
              href={`tel:${customer?.phone}`}
              className="flex justify-center items-center text-xs text-slate-500 gap-1"
            >
              <Phone className="w-3 h-3" />
              {customer.phone}
            </Link>
          </div>
        );
      },
    },
    {
      title: "سرویس و خدمت",
      field: "staff",
      render: (staff, row) => (
        <div key={staff?.id} className="flex justify-center gap-2 items-center">
          <Badge
            variant="outline"
            className="text-xs px-2 py-0 border-slate-200"
          >
            {row.service.name}
          </Badge>
          <span className="text-xs text-slate-400">با {staff.name}</span>
        </div>
      ),
    },
    {
      title: "تاریخ",
      field: "startTime",
      render: (startTime, row) => (
        <div key={row?.id} className="flex justify-center items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(startTime).toLocaleDateString("fa-IR")}
        </div>
      ),
    },
    {
      title: "ساعت",
      field: "startTime",

      render: (startTime: Date, row) => {
        const start = getHour(startTime);
        const end = getHour(row.endTime);

        return (
          <div key={row?.id} className="flex justify-center items-center gap-1">
            <Clock className="w-3 h-3" />
            {start} - {end}
          </div>
        );
      },
    },
    {
      title: "وضعیت",
      field: "status",
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },

    {
      title: "عملیات",
      field: "id",
      render: (id) => <BookingListMoreButton id={id} />,
    },
  ];

  return (
    <ListContainer data={data}>
      <ListHeader title="لیست رزرو‌ها" filter={<BusinessBookingsFilters />} />
      <ListDataProvider>
        <CustomTable columns={columns} />
        <PaginationWrapper
          currentPage={data?.page}
          loading={false}
          onPageChange={onPageChange}
          totalCount={data?.totalItems}
          totalPages={data?.totalPages}
        />
      </ListDataProvider>
    </ListContainer>
  );
};

export default BusinessBookingsTable;
