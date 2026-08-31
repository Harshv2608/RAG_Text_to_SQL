"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const queue_1 = require("../queue/queue");
const router = (0, express_1.Router)();
const querySchema = zod_1.z.object({
    question: zod_1.z.string(),
    tier: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    rag_enabled: zod_1.z.boolean(),
    max_retries: zod_1.z.number().optional().default(5),
    schema_signature: zod_1.z.string().optional()
});
router.post('/', async (req, res) => {
    try {
        const parsed = querySchema.parse(req.body);
        const job = await queue_1.sqlExecutionQueue.add('query-job', parsed, {
            attempts: 1,
            removeOnComplete: false,
            removeOnFail: false
        });
        res.status(202).json({ jobId: job.id });
    }
    catch (e) {
        res.status(400).json({ error: e.errors || 'Invalid request' });
    }
});
router.get('/:jobId/status', async (req, res) => {
    try {
        const job = await queue_1.sqlExecutionQueue.getJob(req.params.jobId);
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        const state = await job.getState();
        const result = job.returnvalue;
        const failedReason = job.failedReason;
        res.json({
            jobId: job.id,
            state,
            result: result || null,
            error: failedReason || null
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=query.js.map