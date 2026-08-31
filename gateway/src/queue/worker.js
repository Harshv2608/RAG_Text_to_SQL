"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqlWorker = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connection = new ioredis_1.default({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
exports.sqlWorker = new bullmq_1.Worker('sql-execution-queue', async (job) => {
    try {
        const { question, tier, rag_enabled, max_retries, schema_signature } = job.data;
        // Transparent pass-through to Python service
        const response = await axios_1.default.post(`${AI_SERVICE_URL}/orchestrate`, {
            question,
            tier,
            rag_enabled,
            max_retries,
            schema_signature: schema_signature || 'users(id, name)\nevents(id, name)'
        }, { timeout: 60000 });
        return response.data;
    }
    catch (error) {
        throw new Error(error.response?.data?.detail || error.message || 'Execution failed');
    }
}, { connection });
//# sourceMappingURL=worker.js.map