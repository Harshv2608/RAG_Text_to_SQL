const fs = require('fs');
const path = require('path');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis();
const sqlExecutionQueue = new Queue('sql-execution-queue', { connection });

async function run() {
  const benchmarkPath = path.resolve(__dirname, '../benchmark/test_benchmark.json');
  const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  const q1 = benchmarkData.find(q => q.tier === 1);
  const q2 = benchmarkData.find(q => q.tier === 2);
  const q3 = benchmarkData.find(q => q.tier === 3);

  const selectedQuestions = [q1, q2, q3];
  const jobs = [];

  for (const item of selectedQuestions) {
    if (!item) continue;
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
  console.log(`Dispatched ${addedJobs.length} pilot jobs.`);
  process.exit(0);
}

run().catch(console.error);
