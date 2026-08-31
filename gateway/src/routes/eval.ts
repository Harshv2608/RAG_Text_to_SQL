import { Router, Request, Response } from 'express';
import { sqlExecutionQueue } from '../queue/queue';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, initManifest, initCondition, getPendingConditions, updateConditionState } from '../db';

const router = Router();

// Deterministic shuffle using a simple LCG
function deterministicShuffle(array: any[], seed: number) {
  let m: number = array.length;
  let t: any;
  let i: number;
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
    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey && req.headers['x-admin-key'] !== adminKey) {
      res.status(401).json({ error: 'Unauthorized. Invalid Admin API Key.' });
      return;
    }

    const { tier, rag } = req.body;
    
    if (typeof tier !== 'number' || typeof rag !== 'boolean') {
      res.status(400).json({ error: 'Missing or invalid tier/rag parameters' });
      return;
    }

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

    // Filter pending conditions that belong to the requested tier and rag state
    const requestedRagVal = rag ? 1 : 0;
    const activeGroup = pending.filter(p => p.tier === tier && p.rag_enabled === requestedRagVal);

    if (activeGroup.length === 0) {
      res.status(200).json({ message: `No pending conditions found for Tier ${tier} RAG ${rag ? 'ON' : 'OFF'}.`, jobIds: [] });
      return;
    }

    // Deterministically shuffle the active group and pick only 1
    const seed = parseInt(datasetSha.substring(0, 8), 16) + tier + requestedRagVal;
    const dispatchList = deterministicShuffle([...activeGroup], seed).slice(0, 1);

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
      message: `Dispatched ${dispatchJobs.length} conditions for Tier ${tier} RAG ${rag ? 'ON' : 'OFF'}.`, 
      jobIds,
      remaining_pending: pending.length - dispatchJobs.length
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error dispatching batch' });
  }
});

export default router;
