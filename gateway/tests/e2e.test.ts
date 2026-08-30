import { sqlExecutionQueue } from '../src/queue/queue';
import { sqlWorker } from '../src/queue/worker';
import request from 'supertest';
import { app } from '../src/index';
import axios from 'axios';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Gateway E2E Evaluation Tests', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    for (let i = 0; i < 15; i++) {
      try {
        await axios.get('http://127.0.0.1:8000/health', { timeout: 1000 });
        break;
      } catch (e) {
        await delay(1000);
      }
    }
  }, 20000);

  afterAll(async () => {
    await sqlWorker.close();
    await sqlWorker.disconnect(); // Ensure background tasks are disconnected
    await sqlExecutionQueue.close();
    await sqlExecutionQueue.disconnect();
    
    // Give ioredis time to fully disconnect
    await delay(1000);
  });

  it('runs a full 60-job evaluation batch without mocking', async () => {
    // Empty queue first to ensure clean state
    await sqlExecutionQueue.obliterate({ force: true });
    
    const res = await request(app).post('/eval').send();
    expect(res.status).toBe(202);
    
    const jobIds: string[] = res.body.jobIds;
    expect(jobIds.length).toBe(60);
    
    let allCompleted = false;
    
    // Poll the summary endpoint until 60 jobs are accounted for
    // Or timeout after 90 seconds
    for (let i = 0; i < 90; i++) {
      const sumRes = await request(app).get('/benchmark/summary');
      const summary = sumRes.body.summary;
      
      let totalCount = 0;
      for (const tier of summary) {
        totalCount += tier['RAG OFF'].count;
        totalCount += tier['RAG ON'].count;
      }
      
      if (totalCount === 60) {
        allCompleted = true;
        break;
      }
      
      await delay(1000);
    }
    
    expect(allCompleted).toBe(true);
    
    // Verify 60 completed jobs are formatted correctly
    for (const jid of jobIds) {
      expect(jid).toMatch(/^eval_.*_tier\d_rag[01]$/);
      const state = await sqlExecutionQueue.getJobState(jid);
      expect(state).toBe('completed');
    }
  }, 100000);
});
