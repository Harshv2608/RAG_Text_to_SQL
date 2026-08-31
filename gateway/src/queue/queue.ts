import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Support generic REDIS_URL for cloud deployments
let redisConfig: any = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

if (process.env.REDIS_URL) {
  const url = new URL(process.env.REDIS_URL);
  redisConfig = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    username: url.username,
    password: url.password,
    maxRetriesPerRequest: null,
    tls: url.protocol === 'rediss:' ? {} : undefined
  };
}

const connection = new IORedis(process.env.REDIS_URL || redisConfig);

export const sqlExecutionQueue = new Queue('sql-execution-queue', { connection });
