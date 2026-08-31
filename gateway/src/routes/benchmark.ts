import { Router, Request, Response } from 'express';
import { db, getAllConditions, getManifest } from '../db';

const router = Router();

router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const manifest = getManifest();
    
    // Natively aggregate using SQLite!
    // We only aggregate stats for conditions that actually successfully executed a model generation (completed or model_failed)
    const sql = `
      SELECT 
        tier,
        rag_enabled,
        COUNT(id) as count,
        SUM(CASE WHEN state = 'completed' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN state = 'model_failed' THEN 1 ELSE 0 END) as model_fail_count,
        SUM(CASE WHEN state = 'infrastructure_failed' THEN 1 ELSE 0 END) as infra_fail_count,
        SUM(CASE WHEN state = 'quota_interrupted' THEN 1 ELSE 0 END) as quota_fail_count,
        SUM(total_tokens) as total_tokens,
        SUM(retries) as total_retries,
        SUM(latency_ms) as total_latency,
        SUM(api_requests_consumed) as total_api_requests
      FROM benchmark_conditions
      WHERE state IN ('completed', 'model_failed', 'infrastructure_failed', 'quota_interrupted')
      GROUP BY tier, rag_enabled
      ORDER BY tier, rag_enabled
    `;
    const rows = db.prepare(sql).all() as any[];

    const summaryData = [1, 2, 3].map(tier => {
      const formatMetrics = (rag: number) => {
        const row = rows.find(r => r.tier === tier && r.rag_enabled === rag);
        if (!row) return { meanRetries: 0, meanTokens: 0, meanLatency: 0, successRate: 0, infraFailureRate: 0, count: 0, apiRequests: 0 };
        
        const validModelCount = row.success_count + row.model_fail_count;
        return {
          meanRetries: validModelCount > 0 ? row.total_retries / validModelCount : 0,
          meanTokens: validModelCount > 0 ? row.total_tokens / validModelCount : 0,
          meanLatency: validModelCount > 0 ? row.total_latency / validModelCount : 0,
          successRate: validModelCount > 0 ? row.success_count / validModelCount : 0,
          infraFailureRate: row.count > 0 ? row.infra_fail_count / row.count : 0,
          quotaInterruptedRate: row.count > 0 ? row.quota_fail_count / row.count : 0,
          count: row.count,
          apiRequests: row.total_api_requests || 0
        };
      };

      return {
        tier: `Tier ${tier}`,
        'RAG OFF': formatMetrics(0),
        'RAG ON': formatMetrics(1)
      };
    });

    // Also get the raw array of condition states for the progress bar
    const rawConditions = getAllConditions();
    const progress = {
      pending: rawConditions.filter((c: any) => c.state === 'pending').length,
      running: rawConditions.filter((c: any) => c.state === 'running').length,
      completed: rawConditions.filter((c: any) => c.state === 'completed').length,
      model_failed: rawConditions.filter((c: any) => c.state === 'model_failed').length,
      infrastructure_failed: rawConditions.filter((c: any) => c.state === 'infrastructure_failed').length,
      quota_interrupted: rawConditions.filter((c: any) => c.state === 'quota_interrupted').length,
      total: rawConditions.length,
      api_requests: rows.reduce((acc, row) => acc + (row.total_api_requests || 0), 0)
    };

    res.json({ manifest, progress, summary: summaryData });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error fetching metrics' });
  }
});

router.get('/conditions', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawConditions = getAllConditions();
    res.json({ conditions: rawConditions });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Error fetching conditions' });
  }
});

export default router;
