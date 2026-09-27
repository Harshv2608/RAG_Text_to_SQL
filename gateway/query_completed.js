const Database = require('better-sqlite3');
const db = new Database('/shared_data/eval.db');
const rows = db.prepare("SELECT id, state, success FROM benchmark_conditions WHERE state='completed'").all();
console.log(rows);
