import "dotenv/config";
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import prisma from "@/utils/prisma";

console.log("🔔 Notification Worker started");

new Worker(
  "notification",
  async (job) => {
    const { notifications, type } = job.data;

    for (const n of notifications) {
      await prisma.notification.create({
        data: {
          userId: n.userId,
          title: n.title,
          body: n.body,
          type,
        },
      });

      if (n.sendSMS) {
        console.log(`📩 SMS sent to user ${n.userId}: ${n.body}`);
      }
    }
  },
  { connection: redis },
);
