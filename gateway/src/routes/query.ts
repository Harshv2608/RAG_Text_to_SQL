import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sqlExecutionQueue } from '../queue/queue';

const router = Router();

const querySchema = z.object({
  question: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  rag_enabled: z.boolean(),
  max_retries: z.number().optional().default(5),
  schema_signature: z.string().optional()
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = querySchema.parse(req.body);
    const job = await sqlExecutionQueue.add('query-job', parsed, {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false
    });
    res.status(202).json({ jobId: job.id });
  } catch (e: any) {
    res.status(400).json({ error: e.errors || 'Invalid request' });
  }
});

router.get('/:jobId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await sqlExecutionQueue.getJob(req.params.jobId);
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
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
