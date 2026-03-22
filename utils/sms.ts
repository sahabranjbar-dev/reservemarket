import api from "@/lib/axios";

type SendSMSResult = {
  success: boolean;
  providerResponse?: any;
  error?: string;
};

export async function sendSMS(
  mobile: string,
  templateId: string,
  parameters: Record<string, string | number>[],
): Promise<SendSMSResult> {
  try {
    const response = await api.post(
      process.env.SMS_URL!,
      {
        mobile,
        templateId,
        parameters,
      },
      {
        headers: {
          "X-API-KEY": process.env.SMS_API_KEY!,
          "Content-Type": "application/json",
          Accept: "text/plain",
        },
      },
    );

    const result = response.data;

    if (result?.status !== 1) {
      return {
        success: false,
        providerResponse: result,
        error: result?.message || "SMS provider error",
      };
    }

    return { success: true, providerResponse: result };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "SMS exception",
    };
  }
}
