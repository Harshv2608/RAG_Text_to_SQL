import { Router, Request, Response } from 'express';
import { sqlExecutionQueue } from '../queue/queue';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, initManifest, initCondition, getPendingConditions, updateConditionState } from '../db';

const router = Router();

// Deterministic shuffle using a simple LCG
function deterministicShuffle(array: any[], seed: number) {
  let m = array.length, t, i;
  while (m) {
    seed = (seed * 9301 + 49297) % 233280;
    i = Math.floor((seed / 233280) * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const benchmarkPath = path.resolve(__dirname, '../../../benchmark/test_benchmark.json');
    const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

    const datasetSha = crypto.createHash('sha256').update(JSON.stringify(benchmarkData)).digest('hex');

    // Initialize manifest
    initManifest({
      experiment_id: 'exp_phase11b',
      commit_sha: process.env.GIT_COMMIT_SHA || 'unknown',
      dataset_sha256: datasetSha,
      model_config: 'gemini-3.5-flash',
      temperature: 0.0,
      retry_limit: 5
    });

    // Seed 60 conditions if not present
    for (const item of benchmarkData) {
      const idOff = `eval_${item.question_id}_tier${item.tier}_rag0`;
      const idOn = `eval_${item.question_id}_tier${item.tier}_rag1`;
      initCondition(idOff, item.question_id, item.tier, false);
      initCondition(idOn, item.question_id, item.tier, true);
    }

    await sqlExecutionQueue.resume();

    const pending = getPendingConditions() as any[];
    if (pending.length === 0) {
      res.status(200).json({ message: 'Experiment already 100% complete.', jobIds: [] });
      return;
    }

    // Determine the lowest active question index
    let lowestIndex = 999;
    pending.forEach(p => {
      const match = p.question_id.match(/_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx < lowestIndex) lowestIndex = idx;
      }
    });

    if (lowestIndex === 999) {
      res.status(500).json({ error: 'Could not determine question group index' });
      return;
    }

    // Filter pending conditions that belong to the lowest active question index
    const activeGroup = pending.filter(p => {
      const match = p.question_id.match(/_(\d+)$/);
      return match && parseInt(match[1], 10) === lowestIndex;
    });

    // Deterministically shuffle the active group based on its index and the dataset sha
    const seed = parseInt(datasetSha.substring(0, 8), 16) + lowestIndex;
    const dispatchList = deterministicShuffle([...activeGroup], seed);

    const dispatchJobs = dispatchList.map(j => ({
      name: `eval-job-${j.question_id}`,
      data: {
        question: benchmarkData.find((b: any) => b.question_id === j.question_id)?.question || '',
        tier: j.tier,
        rag_enabled: j.rag_enabled === 1,
        question_id: j.question_id,
        max_retries: 5,
        job_id: j.id
      },
      opts: {
        jobId: j.id,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    }));

    for (const j of dispatchJobs) {
      updateConditionState(j.opts.jobId, 'running');
    }

    const addedJobs = await sqlExecutionQueue.addBulk(dispatchJobs);
    const jobIds = addedJobs.map(j => j.id);
    
    res.status(202).json({ 
      message: `Dispatched Question Group ${lowestIndex} (${dispatchJobs.length} conditions).`, 
      jobIds,
      remaining_pending: pending.length - dispatchJobs.length
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error dispatching batch' });
  }
});

export default router;
