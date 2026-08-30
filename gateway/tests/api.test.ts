import request from 'supertest';
import { app } from '../src/index';

// Mock BullMQ completely to avoid Redis requirement in tests
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      addBulk: jest.fn().mockImplementation((jobs) => Promise.resolve(jobs.map((j: any) => ({ id: j.opts?.jobId || 'default-id' })))),
      getJob: jest.fn().mockImplementation((id) => {
        if (id === 'job-123') {
          return {
            id,
            getState: jest.fn().mockResolvedValue('completed'),
            returnvalue: { success: true, sql: "SELECT 1" },
            failedReason: null
          };
        }
        return null;
      }),
      client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG'), status: 'ready' })
    })),
    Worker: jest.fn()
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG')
  }));
});

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: { status: 'ok' } }),
  post: jest.fn().mockResolvedValue({ data: { success: true } })
}));

describe('Gateway API Tests', () => {
  it('GET /health returns correct statuses', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.gateway).toBe('up');
    expect(res.body.services.redis).toBe('up');
    expect(res.body.services.ai_service).toBe('up');
  });

  it('POST /query enqueues job and returns 202', async () => {
    const payload = { question: 'count users', tier: 1, rag_enabled: false };
    const res = await request(app).post('/query').send(payload);
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe('job-123');
  });
  
  it('POST /query rejects invalid payload', async () => {
    const payload = { question: 'count users', tier: 4, rag_enabled: false }; // tier 4 invalid
    const res = await request(app).post('/query').send(payload);
    expect(res.status).toBe(400);
  });

  it('GET /query/:jobId/status returns state and result', async () => {
    const res = await request(app).get('/query/job-123/status');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('completed');
    expect(res.body.result.success).toBe(true);
  });
  
  it('GET /query/:jobId/status returns 404 for unknown job', async () => {
    const res = await request(app).get('/query/unknown/status');
    expect(res.status).toBe(404);
  });

  it('POST /eval enqueues bulk jobs and returns 202', async () => {
    const res = await request(app).post('/eval').send(); // payload is ignored now
    expect(res.status).toBe(202);
    expect(res.body.jobIds.length).toBe(60); // 30 questions * 2 RAG states
  });

  it('factorial experiment combinations produce unique job IDs', async () => {
    const res = await request(app).post('/eval').send();
    expect(res.status).toBe(202);
    
    const jobIds = res.body.jobIds;
    const uniqueJobIds = new Set(jobIds);
    expect(uniqueJobIds.size).toBe(60); // all 60 should be unique
  });
});
