"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queue_1 = require("../src/queue/queue");
const worker_1 = require("../src/queue/worker");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../src/index");
const axios_1 = __importDefault(require("axios"));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
describe('Gateway E2E Evaluation Tests', () => {
    beforeAll(async () => {
        // Wait for services to be ready
        for (let i = 0; i < 15; i++) {
            try {
                await axios_1.default.get('http://127.0.0.1:8000/health', { timeout: 1000 });
                break;
            }
            catch (e) {
                await delay(1000);
            }
        }
    }, 20000);
    afterAll(async () => {
        await worker_1.sqlWorker.close();
        await worker_1.sqlWorker.disconnect(); // Ensure background tasks are disconnected
        await queue_1.sqlExecutionQueue.close();
        await queue_1.sqlExecutionQueue.disconnect();
        // Give ioredis time to fully disconnect
        await delay(1000);
    });
    it('runs a full 60-job evaluation batch without mocking', async () => {
        // Empty queue first to ensure clean state
        await queue_1.sqlExecutionQueue.obliterate({ force: true });
        const res = await (0, supertest_1.default)(index_1.app).post('/eval').send();
        expect(res.status).toBe(202);
        const jobIds = res.body.jobIds;
        expect(jobIds.length).toBe(60);
        let allCompleted = false;
        // Poll the summary endpoint until 60 jobs are accounted for
        // Or timeout after 90 seconds
        for (let i = 0; i < 90; i++) {
            const sumRes = await (0, supertest_1.default)(index_1.app).get('/benchmark/summary');
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
            const state = await queue_1.sqlExecutionQueue.getJobState(jid);
            expect(state).toBe('completed');
        }
    }, 100000);
});
//# sourceMappingURL=e2e.test.js.map