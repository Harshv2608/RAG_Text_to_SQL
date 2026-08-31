"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queue_1 = require("../queue/queue");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const counts = await queue_1.sqlExecutionQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused');
        res.json({
            metrics: {
                queue: counts
            }
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});
exports.default = router;
//# sourceMappingURL=metrics.js.map