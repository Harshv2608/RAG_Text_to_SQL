import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../benchmark_results.sqlite');
export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS experiment_manifest (
    experiment_id TEXT PRIMARY KEY,
    commit_sha TEXT,
    dataset_sha256 TEXT,
    model_config TEXT,
    temperature REAL,
    retry_limit INTEGER,
    start_date TEXT
  );

  CREATE TABLE IF NOT EXISTS benchmark_conditions (
    id TEXT PRIMARY KEY,
    question_id TEXT,
    tier INTEGER,
    rag_enabled INTEGER,
    state TEXT,
    success INTEGER,
    final_sql TEXT,
    total_tokens INTEGER,
    api_requests_consumed INTEGER,
    retries INTEGER,
    latency_ms REAL,
    logs TEXT,
    execution_timestamp TEXT
  );
`);

export function initManifest(manifest: any) {
  const existing = db.prepare('SELECT * FROM experiment_manifest LIMIT 1').get();
  if (!existing) {
    const insert = db.prepare(`
      INSERT INTO experiment_manifest (experiment_id, commit_sha, dataset_sha256, model_config, temperature, retry_limit, start_date)
      VALUES (@experiment_id, @commit_sha, @dataset_sha256, @model_config, @temperature, @retry_limit, @start_date)
    `);
    insert.run({
      experiment_id: manifest.experiment_id || 'exp_phase11b',
      commit_sha: manifest.commit_sha || 'unknown',
      dataset_sha256: manifest.dataset_sha256 || 'unknown',
      model_config: manifest.model_config || 'gemini-3.5-flash',
      temperature: manifest.temperature || 0.0,
      retry_limit: manifest.retry_limit || 5,
      start_date: new Date().toISOString()
    });
  }
}

export function initCondition(id: string, question_id: string, tier: number, rag_enabled: boolean) {
  const existing = db.prepare('SELECT * FROM benchmark_conditions WHERE id = ?').get(id);
  if (!existing) {
    db.prepare(`
      INSERT INTO benchmark_conditions (id, question_id, tier, rag_enabled, state, success, final_sql, total_tokens, api_requests_consumed, retries, latency_ms, logs, execution_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, question_id, tier, rag_enabled ? 1 : 0, 'pending', null, null, null, null, null, null, null, null);
  }
}

export function updateConditionState(id: string, state: string, result?: any) {
  if (result) {
    db.prepare(`
      UPDATE benchmark_conditions
      SET state = ?, success = ?, final_sql = ?, total_tokens = ?, api_requests_consumed = ?, retries = ?, latency_ms = ?, logs = ?, execution_timestamp = ?
      WHERE id = ?
    `).run(
      state,
      result.result_correct ? 1 : 0,
      result.final_sql || null,
      result.total_tokens || 0,
      result.api_requests_count || (result.retry_count || 0) + 1, // Fallback if api_requests_count isn't fully piped
      result.retry_count || 0,
      result.latency_ms || 0.0,
      JSON.stringify(result.logs || []),
      new Date().toISOString(),
      id
    );
  } else {
    db.prepare('UPDATE benchmark_conditions SET state = ? WHERE id = ?').run(state, id);
  }
}

export function getPendingConditions() {
  return db.prepare(`
    SELECT * FROM benchmark_conditions 
    WHERE state IN ('pending', 'quota_interrupted', 'infrastructure_failed')
  `).all();
}

export function getAllConditions() {
  return db.prepare('SELECT * FROM benchmark_conditions').all();
}

export function getManifest() {
  return db.prepare('SELECT * FROM experiment_manifest LIMIT 1').get();
}
