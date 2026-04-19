import IORedis from "ioredis";
import "dotenv";

export const redis = new IORedis(process.env.REDIS!, {
  maxRetriesPerRequest: null,
});
