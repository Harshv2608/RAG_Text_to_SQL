"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queue_1 = require("../queue/queue");
const router = (0, express_1.Router)();
router.get('/summary', async (req, res) => {
    try {
        const jobs = await queue_1.sqlExecutionQueue.getJobs(['completed', 'failed']);
        // Structure: aggregations[tier][rag_enabled]
        const aggregations = {
            1: { true: { count: 0, retries: 0, tokens: 0, latency: 0, success: 0 }, false: { count: 0, retries: 0, tokens: 0, latency: 0, success: 0 } },
            2: { true: { count: 0, retries: 0, tokens: 0, latency: 0, success: 0 }, false: { count: 0, retries: 0, tokens: 0, latency: 0, success: 0 } },
            3: { true: { count: 0, retries: 0, tokens: 0, latency: 0, success: 0 }, false: { count: 0, retries: 0, tokens: 0, latency: 0, success: 0 } }
        };
        jobs.forEach(job => {
            // Ensure it's an evaluation job
            if (!job.id || !job.id.startsWith('eval_'))
                return;
            const tierMatch = job.id.match(/_tier(\d+)_/);
            const ragMatch = job.id.match(/_rag([01])$/);
            if (!tierMatch || !ragMatch)
                return;
            const tier = parseInt(tierMatch[1]);
            const ragEnabled = ragMatch[1] === '1';
            const agg = aggregations[tier]?.[ragEnabled ? 'true' : 'false'];
            if (!agg)
                return;
            agg.count++;
            if (job.returnvalue) {
                agg.success += job.returnvalue.success ? 1 : 0;
                agg.retries += job.returnvalue.retries || 0;
                agg.tokens += job.returnvalue.total_tokens || 0;
                agg.latency += job.returnvalue.latency_ms || 0;
                agg.modelCount = (agg.modelCount || 0) + 1;
            }
            else {
                agg.infraFailures = (agg.infraFailures || 0) + 1;
            }
        });
        const formatMetrics = (tier, rag) => {
            const a = aggregations[tier][rag ? 'true' : 'false'];
            if (a.count === 0)
                return { meanRetries: 0, meanTokens: 0, meanLatency: 0, successRate: 0, infraFailureRate: 0, count: 0 };
            const modelCount = a.modelCount || 0;
            const infraFailures = a.infraFailures || 0;
            return {
                meanRetries: modelCount > 0 ? a.retries / modelCount : 0,
                meanTokens: modelCount > 0 ? a.tokens / modelCount : 0,
                meanLatency: modelCount > 0 ? a.latency / modelCount : 0,
                successRate: modelCount > 0 ? a.success / modelCount : 0,
                infraFailureRate: infraFailures / a.count,
                count: a.count
            };
        };
        const summaryData = [1, 2, 3].map(tier => ({
            tier: `Tier ${tier}`,
            'RAG OFF': formatMetrics(tier, false),
            'RAG ON': formatMetrics(tier, true)
        }));
        res.json({ summary: summaryData });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Error fetching metrics' });
    }
});
exports.default = router;
//# sourceMappingURL=benchmark.js.map