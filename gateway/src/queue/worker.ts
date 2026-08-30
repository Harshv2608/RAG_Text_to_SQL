import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

export const sqlWorker = new Worker('sql-execution-queue', async (job: Job) => {
  try {
    const { question, tier, rag_enabled, max_retries, schema_signature } = job.data;
    
    // Transparent pass-through to Python service
    const response = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
      question,
      tier,
      rag_enabled,
      max_retries,
      schema_signature: schema_signature || 'users(id, name)\nevents(id, name)'
    }, { timeout: 60000 });
    
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || error.message || 'Execution failed');
  }
}, { connection });
