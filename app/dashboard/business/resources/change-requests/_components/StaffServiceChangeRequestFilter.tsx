"use client";
import {
  BaseField,
  Combobox,
  DatePicker,
  FilterButtons,
  Form,
  TextCore,
} from "@/components";
import { useRouter, useSearchParams } from "next/navigation";

interface IForm {
  StaffName?: string;
  requestedServiceName?: string;
  requestedStatus?: string;
  submitDate?: string;
}

const statusOptions = [
  { id: "PENDING", farsiTitle: "در انتظار تأیید", englishTitle: "PENDING" },
  { id: "APPROVED", farsiTitle: "تائید شده", englishTitle: "APPROVED" },
  { id: "REJECTED", farsiTitle: "رد شده", englishTitle: "REJECTED" },
];

const StaffServiceChangeRequestFilter = () => {
  const { replace } = useRouter();
  const searchParams = useSearchParams();

  const defaultValues: IForm = {
    requestedServiceName: searchParams.get("requestedServiceName") || "",
    requestedStatus: searchParams.get("requestedStatus") || "",
    StaffName: searchParams.get("StaffName") || "",
    submitDate: searchParams.get("submitDate") as string,
  };

  const onSubmit = (values: IForm) => {
    const params = new URLSearchParams();

    Object.entries(values).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    replace(
      `/dashboard/business/resources/change-requests?${params.toString()}`,
    );
  };

  const removeFilterHandler = () => {
    replace(`/dashboard/business/resources/change-requests`);
  };

  return (
    <Form<IForm>
      onSubmit={onSubmit}
      className="grid grid-cols-1 md:grid-cols-5 gap-2"
      defaultValues={defaultValues}
    >
      {({ reset, setValue }) => {
        return (
          <>
            <BaseField
              component={TextCore}
              label="نام همکار"
              name="StaffName"
            />

            <BaseField
              component={TextCore}
              label="نام درخواستی جدید"
              name="requestedServiceName"
            />

            <BaseField
              component={Combobox}
              label="وضعیت درخواست"
              name="requestedStatus"
              options={statusOptions}
            />

            <BaseField
              component={DatePicker}
              label="تاریخ ثبت"
              name="submitDate"
            />

            <FilterButtons
              removeFilterHandler={() => {
                setValue("submitDate", "");
                reset();
                removeFilterHandler();
              }}
            />
          </>
        );
      }}
    </Form>
  );
};

export default StaffServiceChangeRequestFilter;
