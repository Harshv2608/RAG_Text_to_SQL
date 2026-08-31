"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const queue_1 = require("../queue/queue");
const router = (0, express_1.Router)();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
router.get('/', async (req, res) => {
    let redisStatus = 'down';
    let aiServiceStatus = 'down';
    try {
        const client = await queue_1.sqlExecutionQueue.client;
        if (client.status === 'ready') {
            redisStatus = 'up';
        }
        else {
            await client.ping();
            redisStatus = 'up';
        }
    }
    catch (e) { }
    try {
        // Check python backend health (assuming a generic root or health endpoint, here we just catch any response or connection)
        await axios_1.default.get(`${AI_SERVICE_URL}/`, { timeout: 2000 });
        aiServiceStatus = 'up';
    }
    catch (e) {
        if (e.response) {
            // It's up even if it 404s the root
            aiServiceStatus = 'up';
        }
    }
    res.json({
        status: 'ok',
        services: {
            gateway: 'up',
            redis: redisStatus,
            ai_service: aiServiceStatus
        }
    });
});
exports.default = router;
//# sourceMappingURL=health.js.map