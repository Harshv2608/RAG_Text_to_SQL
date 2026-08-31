import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import dotenv from 'dotenv';
import { updateConditionState } from '../db';

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

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const DAILY_BUDGET = parseInt(process.env.DAILY_BUDGET || '18');

let session_requests_consumed = 0;

export const sqlWorker = new Worker('sql-execution-queue', async (job: Job) => {
  const jobId = job.opts.jobId as string;
  try {
    const { question, tier, rag_enabled, max_retries, schema_signature } = job.data;
    
    console.log(`Processing job ${jobId} for question: ${question}`);
    const response = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
      question,
      tier,
      rag_enabled,
      max_retries,
      schema_signature: schema_signature || 'users(id, name)\nevents(id, name)'
    }, { timeout: 60000 });
    
    const result = response.data;
    const requests_consumed = result.api_requests_count || (result.retries || 0) + 1;
    session_requests_consumed += requests_consumed;
    
    const state = result.success ? 'completed' : 'model_failed';
    updateConditionState(jobId, state, result);

    console.log(`Job ${jobId} done (State: ${state}). Session requests: ${session_requests_consumed}/${DAILY_BUDGET}`);

    if (session_requests_consumed >= DAILY_BUDGET) {
      console.warn(`Safety ceiling of ${DAILY_BUDGET} reached. Pausing queue.`);
      await sqlWorker.pause();
    }
    
    return result;
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || error.message || 'Execution failed';
    console.error(`Error on job ${jobId}: ${errorMsg}`);
    
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('Quota')) {
      console.warn(`Quota Exceeded (429) hit! Pausing queue.`);
      updateConditionState(jobId, 'quota_interrupted');
      await sqlWorker.pause();
      throw new Error(`Quota Interrupted: ${errorMsg}`);
    } else {
      updateConditionState(jobId, 'infrastructure_failed');
      throw new Error(`Infrastructure Failure: ${errorMsg}`);
    }
  }
}, { connection });
