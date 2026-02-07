import { BusinessRole } from "@/constants/enums";
import { authOptions } from "@/utils/authOptions";
import { convertToEnglishDigits } from "@/utils/common";
import prisma from "@/utils/prisma";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import StaffServiceChangeRequestsList from "./_components/StaffServiceChangeRequestsList";

interface Props {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    requestedServiceName?: string;
    requestedStatus?: string;
    StaffName?: string;
    submitDate?: Date;
  }>;
}

const StaffServiceChangeRequest = async ({ searchParams }: Props) => {
  const session = await getServerSession(authOptions);

  const businessId = session?.user.business?.id;

  if (session?.user.business?.businessRole !== BusinessRole.OWNER) {
    notFound();
  }

  const {
    page,
    pageSize,
    requestedServiceName,
    StaffName,
    requestedStatus,
    submitDate,
  } = await searchParams;

  const resolvedPage = Number(convertToEnglishDigits(pageSize || "1")) || 1;
  const resolvedPageSize = Number(convertToEnglishDigits(page || "10")) || 10;

  const where: any = {
    service: {
      businessId,
    },
    staff: {
      businessId,
    },
  };

  if (requestedServiceName) {
    where.requestedName = {
      contains: requestedServiceName,
      mode: "insensitive",
    };
  }

  if (StaffName) {
    where.staff = {
      ...where.staff,
      name: {
        contains: StaffName,
        mode: "insensitive",
      },
    };
  }

  if (requestedStatus) {
    where.status = requestedStatus;
  }

  if (submitDate) {
    const date = new Date(submitDate);
    where.createdAt = {
      gte: new Date(date.setHours(0, 0, 0, 0)),
      lte: new Date(date.setHours(23, 59, 59, 999)),
    };
  }

  const changeRequests = await prisma.staffServiceChangeRequest.findMany({
    where,
    skip: (resolvedPage - 1) * resolvedPageSize,
    take: resolvedPageSize,
    include: {
      staff: {
        select: {
          name: true,
          phone: true,
        },
      },
      service: true,
    },
  });

  const resultList = changeRequests.map((item, index) => ({
    ...item,
    rowNumber: (resolvedPage - 1) * resolvedPageSize + index + 1,
  }));

  const totalItems = await prisma.staffServiceChangeRequest.count({
    where,
  });

  const data = {
    resultList,
    totalItems,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    totalPages: Math.ceil(totalItems / resolvedPageSize),
  };

  return <StaffServiceChangeRequestsList data={data} />;
};

export default StaffServiceChangeRequest;
