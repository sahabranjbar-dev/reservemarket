"use server";
import prisma from "@/utils/prisma";

type LogLevel = "INFO" | "WARN" | "ERROR";

interface CreateLogParams {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

export async function createLog(params: CreateLogParams) {
  const { level, message, context } = params;

  try {
    await prisma.log.create({
      data: { level, message, context },
    });
  } catch (e) {
    console.error("System Log failed:", e);
  }
}
