import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/schema', async (req: Request, res: Response) => {
  try {
    const schemaPath = path.join(__dirname, '../../../benchmark/schema/schema.sql');
    const content = fs.readFileSync(schemaPath, 'utf8');
    
    // Parse the SQL to JSON for tabular display
    const tables: any[] = [];
    const tableRegex = /CREATE TABLE (\w+)\s*\(([\s\S]*?)\);/g;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const cols = match[2].split(',\n').map(line => line.trim()).filter(line => line && !line.startsWith('--'));
      
      const columns = cols.map(col => {
        // e.g. "id UUID PRIMARY KEY DEFAULT uuid_generate_v4()"
        const parts = col.split(/\s+/);
        const name = parts[0];
        const type = parts[1];
        const details = parts.slice(2).join(' ');
        return { name, type, details };
      });
      
      tables.push({ tableName, columns });
    }
    
    res.json({ schema: tables });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read schema file' });
  }
});

router.get('/queries', async (req: Request, res: Response) => {
  try {
    const queryPath = path.join(__dirname, '../../../benchmark/test_benchmark.json');
    const content = fs.readFileSync(queryPath, 'utf8');
    res.json({ queries: JSON.parse(content) });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read queries file' });
  }
});

export default router;
