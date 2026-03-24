import "dotenv/config";
import { Worker } from "bullmq";

import { redis } from "../lib/redis";
import {
  handle1hReminder,
  handle24hReminder,
  handleCreateNotification,
} from "./handlers";

console.log("🔔 Notification Worker started");

new Worker(
  "notification",
  async (job) => {
    switch (job.name) {
      case "CREATE_NOTIFICATION":
        console.log("CREATE_NOTIFICATION");

        return handleCreateNotification(job.data);

      case "SEND_REMINDER_24H":
        console.log("SEND_REMINDER_24H");

        return handle24hReminder(job.data);

      case "SEND_REMINDER_1H":
        console.log("SEND_REMINDER_1H");

        return handle1hReminder(job.data);

      default:
        throw new Error("Unknown job type");
    }
  },
  { connection: redis as any },
);
