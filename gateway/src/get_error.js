const Database = require('better-sqlite3');
const db = new Database('/shared_data/eval.db');
const failed = db.prepare("SELECT id, state, logs FROM benchmark_conditions WHERE state='model_failed' LIMIT 1").get();
console.log(JSON.stringify(failed, null, 2));
