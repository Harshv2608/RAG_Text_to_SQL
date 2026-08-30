import { Router, Request, Response } from 'express';
import { sqlExecutionQueue } from '../queue/queue';
import fs from 'fs';
import path from 'path';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // 7.4 Read the authoritative benchmark file directly
    const benchmarkPath = path.resolve(__dirname, '../../../benchmark/test_benchmark.json');
    const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

    const jobs = [];
    
    // For each of the 30 questions, enqueue 2 jobs (RAG OFF and RAG ON) -> 60 distinct runs
    for (const item of benchmarkData) {
      // Condition 1: RAG OFF
      jobs.push({
        name: `eval-job-${item.question_id}`,
        data: {
          question: item.question,
          tier: item.tier,
          rag_enabled: false,
          question_id: item.question_id,
          max_retries: 5
        },
        opts: {
          jobId: `eval_${item.question_id}_tier${item.tier}_rag0`,
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false
        }
      });

      // Condition 2: RAG ON
      jobs.push({
        name: `eval-job-${item.question_id}`,
        data: {
          question: item.question,
          tier: item.tier,
          rag_enabled: true,
          question_id: item.question_id,
          max_retries: 5
        },
        opts: {
          jobId: `eval_${item.question_id}_tier${item.tier}_rag1`,
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false
        }
      });
    }
    
    const addedJobs = await sqlExecutionQueue.addBulk(jobs);
    const jobIds = addedJobs.map(j => j.id);
    
    res.status(202).json({ message: 'Factorial batch queued', jobIds });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error parsing benchmark' });
  }
});

export default router;
