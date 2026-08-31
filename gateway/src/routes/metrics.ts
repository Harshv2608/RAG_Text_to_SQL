import { Router, Request, Response } from 'express';
import { sqlExecutionQueue } from '../queue/queue';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const counts = await sqlExecutionQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
    res.json({
      metrics: {
        queue: counts
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
